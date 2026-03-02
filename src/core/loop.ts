/**
 * 主代理循环 - 兼容包装层
 *
 * 保留 agentLoop() 签名，内部调用 generator 并消费事件，
 * 通过 UIController 分发事件（保持向后兼容）。
 */

import type {
  Message,
  ToolDefinition,
  ExecuteToolFunc,
} from './types.js';
import type { ProtocolAdapter } from '../services/ai/adapters/base.js';
import type { PermissionManager } from './permissions.js';
import type { HookManager } from './hooks.js';
import type { UIController } from '../ui/UIController.js';
import type { TokenTracker } from '../utils/tokenTracker.js';
import type { HierarchicalAbortController } from './abort.js';
import { agentLoopGenerator } from './loopGenerator.js';

/**
 * 代理循环配置
 */
export interface AgentLoopOptions {
  maxTokens?: number;
  maxTurns?: number;
  silent?: boolean;
  onToolCall?: (name: string, count: number, elapsed: number) => void;
  permissionManager?: PermissionManager;
  hookManager?: HookManager;
  abortController?: AbortController | HierarchicalAbortController;
  tokenTracker?: TokenTracker;
  uiController?: UIController;
}

/**
 * 代理循环结果
 */
export interface AgentLoopResult {
  history: Message[];
  toolCount: number;
  elapsed: number;
}

/**
 * 主代理循环（兼容包装层）
 *
 * 内部调用 generator 并消费事件，通过 UIController 分发。
 */
export async function agentLoop(
  history: Message[],
  systemPrompt: string,
  tools: ToolDefinition[],
  adapter: ProtocolAdapter,
  executeTool: ExecuteToolFunc,
  options: AgentLoopOptions = {}
): Promise<Message[]> {
  const { uiController, ...generatorOptions } = options;

  const gen = agentLoopGenerator(
    history,
    systemPrompt,
    tools,
    adapter,
    executeTool,
    generatorOptions
  );

  let finalHistory: Message[] | undefined;

  for await (const event of gen) {
    // 如果没有 uiController，只消费事件不做 UI 操作
    if (!uiController) continue;

    switch (event.type) {
      case 'thinking_start':
        uiController.showThinking();
        break;

      case 'thinking_stop':
        uiController.hideThinking();
        break;

      case 'stream_text':
        uiController.appendStreamText(event.text);
        break;

      case 'stream_done':
        uiController.finalizeStream(event.fullText, false);
        break;

      case 'tool_start':
        uiController.showToolStart(event.toolName, event.toolUseId, event.input);
        break;

      case 'tool_result':
        uiController.showToolResult(event.toolName, event.toolUseId, event.result, event.isError);
        break;

      case 'tool_queued':
        uiController.showToolQueued(event.toolName, event.toolUseId, event.input);
        break;

      case 'permission_request':
        // 兼容层：通过 uiController 请求权限并回调 resolve
        try {
          const result = await uiController.requestPermission(
            event.toolName,
            event.params,
            event.reason,
            {
              commandPrefix: event.commandPrefix,
              commandInjectionDetected: event.commandInjectionDetected,
            }
          );
          event.resolve(result);
        } catch {
          event.resolve({ decision: 'deny' });
        }
        break;

      case 'retry':
        uiController.showRetry(event.attempt, event.maxAttempts, event.delay, event.error);
        uiController.showThinking();
        break;

      case 'error':
        uiController.showError(event.message);
        break;

      case 'info':
        uiController.showInfo(event.message);
        break;

      case 'warning':
        uiController.showWarning(event.message);
        break;

      case 'turn_complete':
        finalHistory = event.history;
        break;
    }
  }

  // 返回 turn_complete 事件中的历史，或 fallback 原始历史
  return finalHistory ?? history;
}

/**
 * 兼容旧版调用方式
 */
export async function agentLoopLegacy(
  history: Message[],
  systemPrompt: string,
  tools: ToolDefinition[],
  adapter: ProtocolAdapter,
  executeTool: ExecuteToolFunc,
  maxTokens: number = 4096,
  maxTurns: number = 20
): Promise<Message[]> {
  return agentLoop(history, systemPrompt, tools, adapter, executeTool, {
    maxTokens,
    maxTurns,
  });
}
