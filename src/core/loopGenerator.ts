/**
 * Generator 版代理循环
 *
 * 将 agentLoop 从 Promise<Message[]> 改为 async generator，
 * 通过 yield AgentEvent 实现事件驱动，彻底解耦业务逻辑与 UI。
 */

import type {
  Message,
  ToolDefinition,
  ToolResult,
  ExecuteToolFunc,
} from './types.js';
import type { ProtocolAdapter } from '../services/ai/adapters/base.js';
import type { PermissionDecision, PermissionManager } from './permissions.js';
import type { HookManager } from './hooks.js';
import type { TokenTracker } from '../utils/tokenTracker.js';
import type { HierarchicalAbortController } from './abort.js';
import type { AgentEvent } from './agentEvent.js';
import { getReminderManager } from './reminder.js';
import { withRetry } from '../utils/retry.js';
import { DEFAULTS, TOOL_REJECT_MESSAGE } from './constants.js';
import { getCommandSubcommandPrefix } from './commandPrefix.js';
import { normalizeToolExecutionResult, toolResultContentToText } from './toolResult.js';

/**
 * Generator 版代理循环配置
 */
export interface AgentLoopGeneratorOptions {
  maxTokens?: number;
  maxTurns?: number;
  silent?: boolean;
  onToolCall?: (name: string, count: number, elapsed: number) => void;
  permissionManager?: PermissionManager;
  hookManager?: HookManager;
  abortController?: AbortController | HierarchicalAbortController;
  tokenTracker?: TokenTracker;
}

/**
 * 事件队列 — 桥接回调与 yield
 */
class EventQueue {
  private queue: AgentEvent[] = [];
  private resolve: (() => void) | null = null;

  enqueue(event: AgentEvent): void {
    this.queue.push(event);
    if (this.resolve) {
      this.resolve();
      this.resolve = null;
    }
  }

  async *drain(): AsyncGenerator<AgentEvent, void, void> {
    while (this.queue.length > 0) {
      yield this.queue.shift()!;
    }
  }

  waitForEvents(): Promise<void> {
    if (this.queue.length > 0) {
      return Promise.resolve();
    }
    return new Promise<void>((r) => {
      this.resolve = r;
    });
  }

  get length(): number {
    return this.queue.length;
  }
}

/**
 * Generator 版代理循环
 *
 * 产出 AgentEvent 流，最终 return 完整的消息历史。
 */
export async function* agentLoopGenerator(
  history: Message[],
  systemPrompt: string,
  tools: ToolDefinition[],
  adapter: ProtocolAdapter,
  executeTool: ExecuteToolFunc,
  options: AgentLoopGeneratorOptions = {}
): AsyncGenerator<AgentEvent, Message[], void> {
  const {
    maxTokens = 4096,
    maxTurns = 20,
    silent = false,
    onToolCall,
    permissionManager,
    hookManager,
    abortController,
    tokenTracker,
  } = options;

  let currentHistory = [...history];
  let turns = 0;
  let totalToolCount = 0;
  const startTime = Date.now();
  const reminderManager = getReminderManager();

  while (turns < maxTurns) {
    turns++;

    // 检查中断
    if (abortController?.signal.aborted) {
      break;
    }

    let streamedText = '';

    try {
      // 1. 思考开始
      if (!silent) {
        yield { type: 'thinking_start' };
      }

      // 2. 流式调用 LLM API（带重试）
      // 使用事件队列桥接 onText 回调与 yield
      const eventQueue = new EventQueue();
      let streamResolve: ((value: Awaited<ReturnType<typeof adapter.createStreamMessage>>) => void) | null = null;
      let streamReject: ((error: Error) => void) | null = null;
      const streamPromise = new Promise<Awaited<ReturnType<typeof adapter.createStreamMessage>>>((res, rej) => {
        streamResolve = res;
        streamReject = rej;
      });

      // 启动流式请求（异步）
      withRetry(
        () => {
          streamedText = '';
          return adapter.createStreamMessage(
            systemPrompt,
            currentHistory,
            adapter.convertTools(tools),
            maxTokens,
            {
              onText: (text) => {
                if (!silent) {
                  if (streamedText === '') {
                    eventQueue.enqueue({ type: 'thinking_stop' });
                  }
                  eventQueue.enqueue({ type: 'stream_text', text });
                }
                streamedText += text;
              },
              signal: abortController?.signal,
            }
          );
        },
        { maxRetries: 3 },
        (attempt, error, delay) => {
          if (!silent) {
            eventQueue.enqueue({
              type: 'retry',
              attempt,
              maxAttempts: 3,
              delay,
              error: error.message,
            });
            // 重试前重置
            streamedText = '';
          }
        }
      ).then(
        (result) => {
          streamResolve!(result);
        },
        (error) => {
          streamReject!(error instanceof Error ? error : new Error(String(error)));
        }
      );

      // 在流式传输期间持续 yield 队列中的事件
      let streamResult: Awaited<ReturnType<typeof adapter.createStreamMessage>> | null = null;
      let streamError: Error | null = null;

      // 竞速：持续 drain 事件队列，直到 stream 完成
      // 请求级超时
      let streamTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
      const timeoutPromise = new Promise<never>((_, reject) => {
        streamTimeoutTimer = setTimeout(() => {
          reject(new Error('API_STREAM_TIMEOUT: 流式请求超时（5分钟无响应）'));
        }, DEFAULTS.apiStreamTimeout);
      });

      try {
        while (true) {
          // 检查 stream 是否已完成
          const raceResult = await Promise.race([
            streamPromise.then((r) => ({ done: true as const, result: r })),
            eventQueue.waitForEvents().then(() => ({ done: false as const })),
            timeoutPromise,
          ]);

          // 先 drain 队列中已有的事件
          for await (const event of eventQueue.drain()) {
            yield event;
          }

          if (raceResult.done) {
            streamResult = raceResult.result;
            break;
          }
        }
      } finally {
        if (streamTimeoutTimer) {
          clearTimeout(streamTimeoutTimer);
          streamTimeoutTimer = null;
        }
      }

      // 处理 stream 错误
      try {
        if (!streamResult) {
          streamResult = await streamPromise;
        }
      } catch (e) {
        streamError = e instanceof Error ? e : new Error(String(e));
      }

      if (streamError) {
        throw streamError;
      }

      // 3. 思考停止
      if (!silent) {
        yield { type: 'thinking_stop' };
      }

      // 3.5 记录 Token 使用
      if (tokenTracker && streamResult!.usage) {
        tokenTracker.addRecord(streamResult!.usage);
      }

      // 4. 处理中断
      if (streamResult!.stopReason === 'interrupted' || abortController?.signal.aborted) {
        if (!silent && streamedText) {
          yield { type: 'info', message: '[生成已中断]' };
        }
        if (streamedText) {
          currentHistory.push({
            role: 'assistant',
            content: [{ type: 'text', text: streamedText }],
          });
        }
        break;
      }

      // 5. 提取工具调用
      const { toolCalls, stopReason } = streamResult!;
      const isFinalResponse =
        toolCalls.length === 0 || (stopReason !== 'tool_use' && stopReason !== 'tool_calls');

      // 6. 流式文本完成事件（始终 yield，避免跨轮泄漏）
      if (!silent && streamedText) {
        yield {
          type: 'stream_done',
          fullText: streamedText,
        };
      }

      // 7. 将助手消息添加到历史
      currentHistory.push(streamResult!.assistantMessage);

      // 8. 没有工具调用则结束
      if (isFinalResponse) {
        break;
      }

      // 8.5 记录工具调用（用于 reminder）
      const toolNames = toolCalls.map((tc) => tc.name);
      reminderManager.recordToolCalls(toolNames);

      // 8.6 工具进入队列（用于 UI 展示）
      if (!silent) {
        for (const toolCall of toolCalls) {
          eventQueue.enqueue({
            type: 'tool_queued',
            toolUseId: toolCall.id,
            toolName: toolCall.name,
            input: toolCall.input,
          });
        }

        for await (const event of eventQueue.drain()) {
          yield event;
        }
      }

      // 9. 权限检查
      if (permissionManager) {
        for (const toolCall of toolCalls) {
          const checkResult = permissionManager.check(toolCall.name, toolCall.input);

          if (!checkResult.allowed) {
            const toolResults: ToolResult[] = [
              {
                tool_use_id: toolCall.id,
                content: `权限被拒绝: ${checkResult.reason || '操作不被允许'}`,
                is_error: true,
                name: toolCall.name,
              },
            ];
            const toolResultsMessage = adapter.formatToolResults(toolResults);
            currentHistory.push(toolResultsMessage);
            if (!silent) {
              eventQueue.enqueue({
                type: 'tool_result',
                toolUseId: toolCall.id,
                toolName: toolCall.name,
                result: toolResultContentToText(toolResults[0]!.content),
                isError: true,
              });
              for await (const event of eventQueue.drain()) {
                yield event;
              }
            }
            continue;
          }

          if (checkResult.needsConfirmation && !silent) {
            // 触发 hook
            if (hookManager?.hasHooksFor('PermissionRequest')) {
              await hookManager.emit('PermissionRequest', {
                toolName: toolCall.name,
                toolInput: toolCall.input,
              });
            }

            // 1. 创建 Promise，捕获 resolve
            let confirmResolve!: (r: PermissionDecision) => void;
            const confirmationPromise = new Promise<PermissionDecision>((resolve) => {
              confirmResolve = resolve;
            });

            let commandPrefix: string | null | undefined;
            let commandInjectionDetected: boolean | undefined;
            if (toolCall.name === 'bash') {
              const command = typeof toolCall.input.command === 'string' ? toolCall.input.command : '';
              if (command) {
                try {
                  const prefixResult = await getCommandSubcommandPrefix(command, adapter);
                  if (prefixResult?.commandInjectionDetected) {
                    commandInjectionDetected = true;
                  } else {
                    commandPrefix = prefixResult?.commandPrefix ?? null;
                  }
                } catch {
                  // 前缀检测失败不影响权限流程
                }
              }
            }

            // 2. 入队事件（携带 resolve）
            eventQueue.enqueue({
              type: 'permission_request',
              toolName: toolCall.name,
              params: toolCall.input,
              reason: checkResult.reason,
              commandPrefix,
              commandInjectionDetected,
              resolve: confirmResolve,
            });

            // 3. drain + yield → 消费者收到事件
            for await (const event of eventQueue.drain()) {
              yield event;
            }

            // 4. 消费者处理完后 resolve，此时 await 立即返回
            const confirmation = await confirmationPromise;

            if (confirmation.decision === 'allow_always') {
              permissionManager.setAlwaysAllow(toolCall.name, {
                scope: confirmation.scope,
                key: confirmation.key,
                params: toolCall.input,
              });
            }

            if (confirmation.decision === 'deny') {
              const toolResults: ToolResult[] = [
                {
                  tool_use_id: toolCall.id,
                  content: TOOL_REJECT_MESSAGE,
                  is_error: true,
                  name: toolCall.name,
                },
              ];
              const toolResultsMessage = adapter.formatToolResults(toolResults);
              currentHistory.push(toolResultsMessage);
              if (!silent) {
                eventQueue.enqueue({
                  type: 'tool_result',
                  toolUseId: toolCall.id,
                  toolName: toolCall.name,
                  result: TOOL_REJECT_MESSAGE,
                  isError: true,
                });
                for await (const event of eventQueue.drain()) {
                  yield event;
                }
              }
              continue;
            }
          }
        }
      }

      // 10. PreToolUse Hook
      if (hookManager?.hasHooksFor('PreToolUse')) {
        for (const toolCall of toolCalls) {
          const hookResults = await hookManager.emit('PreToolUse', {
            toolName: toolCall.name,
            toolInput: toolCall.input,
          });

          const blocked = hookResults.some((r: { blocked?: boolean }) => r.blocked);
          if (blocked && !silent) {
            yield { type: 'warning', message: `Hook 阻止了工具 ${toolCall.name} 的执行` };
          }
        }
      }

      // 11. 并行执行所有工具
      const toolResults: ToolResult[] = [];

      const toolPromises = toolCalls.map(async (toolCall, index) => {
        const toolIndex = totalToolCount + index + 1;
        const elapsed = (Date.now() - startTime) / 1000;

        try {
          // 工具开始事件
          if (!silent) {
            eventQueue.enqueue({
              type: 'tool_start',
              toolUseId: toolCall.id,
              toolName: toolCall.name,
              input: toolCall.input,
            });
          }

          // 回调
          if (onToolCall) {
            onToolCall(toolCall.name, toolIndex, elapsed);
          }

          // 执行工具
          const rawResult = await executeTool(toolCall.name, toolCall.input);
          const result = normalizeToolExecutionResult(rawResult);

          // PostToolUse Hook
          if (hookManager?.hasHooksFor('PostToolUse')) {
              await hookManager.emit('PostToolUse', {
                toolName: toolCall.name,
                toolInput: toolCall.input,
                toolOutput: result.uiContent,
              });
          }

          // 工具结果事件
          if (!silent) {
            eventQueue.enqueue({
              type: 'tool_result',
              toolUseId: toolCall.id,
              toolName: toolCall.name,
              result: result.uiContent,
              isError: result.isError,
            });
          }

          return {
            tool_use_id: toolCall.id,
            content: result.content,
            is_error: result.isError,
            name: toolCall.name,
          };
        } catch (error: unknown) {
          const errorMsg = error instanceof Error ? error.message : String(error);

          // PostToolUseFailure Hook
          if (hookManager?.hasHooksFor('PostToolUseFailure')) {
            await hookManager.emit('PostToolUseFailure', {
              toolName: toolCall.name,
              toolInput: toolCall.input,
              error: errorMsg,
            });
          }

          if (!silent) {
            eventQueue.enqueue({
              type: 'tool_result',
              toolUseId: toolCall.id,
              toolName: toolCall.name,
              result: `工具执行失败: ${errorMsg}`,
              isError: true,
            });
          }

          return {
            tool_use_id: toolCall.id,
            content: `工具执行失败: ${errorMsg}`,
            is_error: true,
            name: toolCall.name,
          };
        }
      });

      // 等待所有工具执行完成
      const results = await Promise.all(toolPromises);
      toolResults.push(...results);
      totalToolCount += toolCalls.length;

      // drain 工具执行期间产生的事件
      for await (const event of eventQueue.drain()) {
        yield event;
      }

      // 12. 格式化工具结果并添加到历史
      const toolResultsMessage = adapter.formatToolResults(toolResults);
      currentHistory.push(toolResultsMessage);
    } catch (error: unknown) {
      // 停止思考
      if (!silent) {
        yield { type: 'thinking_stop' };
      }

      // 中断导致的错误
      if (abortController?.signal.aborted) {
        if (!silent) {
          yield { type: 'info', message: '[生成已中断]' };
        }
        if (streamedText) {
          currentHistory.push({
            role: 'assistant',
            content: [{ type: 'text', text: streamedText }],
          });
        }
        break;
      }

      const errorMsg = error instanceof Error ? error.message : String(error);
      if (!silent) {
        yield { type: 'error', message: `API 调用失败: ${errorMsg}` };
      }

      throw error;
    }
  }

  if (turns >= maxTurns && !silent) {
    yield { type: 'warning', message: `达到最大轮次限制 (${maxTurns})` };
  }

  // 完成事件
  yield { type: 'turn_complete', history: currentHistory };

  return currentHistory;
}
