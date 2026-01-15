/**
 * 主代理循环 - 核心逻辑
 */

import type {
  Message,
  ToolDefinition,
  ToolResult,
  ExecuteToolFunc,
} from './types.js';
import type { ProtocolAdapter } from '../services/ai/adapters/base.js';
import { thinkingSpinner, ToolDisplay } from '../ui/index.js';
import { getReminderManager } from './reminder.js';

/**
 * 代理循环配置
 */
export interface AgentLoopOptions {
  maxTokens?: number;
  maxTurns?: number;
  silent?: boolean; // 静默模式（用于子代理）
  onToolCall?: (name: string, count: number, elapsed: number) => void; // 工具调用回调
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
 * 主代理循环
 *
 * 实现思考 → 工具使用 → 响应的循环
 */
export async function agentLoop(
  history: Message[],
  systemPrompt: string,
  tools: ToolDefinition[],
  adapter: ProtocolAdapter,
  executeTool: ExecuteToolFunc,
  options: AgentLoopOptions = {}
): Promise<Message[]> {
  const {
    maxTokens = 4096,
    maxTurns = 20,
    silent = false,
    onToolCall,
  } = options;

  let currentHistory = [...history];
  let turns = 0;
  let totalToolCount = 0;
  const startTime = Date.now();
  const reminderManager = getReminderManager();

  while (turns < maxTurns) {
    turns++;

    try {
      // 1. 显示思考动画（非静默模式）
      if (!silent) {
        thinkingSpinner.start();
      }

      // 2. 调用 LLM API
      const response = await adapter.createMessage(
        systemPrompt,
        currentHistory,
        adapter.convertTools(tools),
        maxTokens
      );

      // 3. 停止思考动画
      if (!silent) {
        thinkingSpinner.stop();
      }

      // 4. 提取文本块和工具调用
      const { textBlocks, toolCalls, stopReason } = adapter.extractTextAndToolCalls(response);

      // 5. 显示文本内容（非静默模式）
      if (!silent) {
        for (const text of textBlocks) {
          if (text.trim()) {
            console.log(text);
          }
        }
      }

      // 6. 将助手消息添加到历史
      const assistantMessage = adapter.formatAssistantMessage(response);
      currentHistory.push(assistantMessage);

      // 7. 如果没有工具调用或 stop_reason 不是 tool_use，结束循环
      // 注意：先检查 stopReason，再处理工具
      if (toolCalls.length === 0 || (stopReason !== 'tool_use' && stopReason !== 'tool_calls')) {
        break;
      }

      // 8. 记录工具调用（用于 reminder）
      const toolNames = toolCalls.map(tc => tc.name);
      reminderManager.recordToolCalls(toolNames);


      // 9. 并行执行所有工具
      const toolResults: ToolResult[] = [];

      // 并行执行所有工具调用
      const toolPromises = toolCalls.map(async (toolCall, index) => {
        const toolIndex = totalToolCount + index + 1;
        const elapsed = (Date.now() - startTime) / 1000;

        try {
          // 显示工具开始（非静默模式）
          if (!silent) {
            ToolDisplay.printStart(
              toolCall.name,
              JSON.stringify(toolCall.input).slice(0, 50)
            );
          }

          // 回调（用于子代理进度显示）
          if (onToolCall) {
            onToolCall(toolCall.name, toolIndex, elapsed);
          }

          // 执行工具
          const result = await executeTool(toolCall.name, toolCall.input);

          // 显示工具结果（非静默模式）
          const isError = result.startsWith('错误:') || result.startsWith('Error:');

          if (!silent) {
            if (isError) {
              ToolDisplay.printOutput(result, { isError: true, maxLines: 5 });
            } else {
              // 显示摘要
              const summary = result.split('\n')[0].slice(0, 80);
              ToolDisplay.printResult(summary);
            }
          }

          // 返回结果
          return {
            tool_use_id: toolCall.id,
            content: result,
            is_error: isError,
          };
        } catch (error: unknown) {
          const errorMsg = error instanceof Error ? error.message : String(error);

          if (!silent) {
            ToolDisplay.printOutput(`工具执行失败: ${errorMsg}`, { isError: true });
          }

          return {
            tool_use_id: toolCall.id,
            content: `工具执行失败: ${errorMsg}`,
            is_error: true,
          };
        }
      });

      // 等待所有工具执行完成
      const results = await Promise.all(toolPromises);
      toolResults.push(...results);
      totalToolCount += toolCalls.length;

      // 10. 格式化工具结果并添加到历史
      const toolResultsMessage = adapter.formatToolResults(toolResults);
      currentHistory.push(toolResultsMessage);

    } catch (error: unknown) {
      // API 调用失败
      if (!silent) {
        thinkingSpinner.stop();
      }

      const errorMsg = error instanceof Error ? error.message : String(error);
      if (!silent) {
        console.error(`\nAPI 调用失败: ${errorMsg}`);
      }

      throw error;
    }
  }

  if (turns >= maxTurns && !silent) {
    console.warn(`\n警告: 达到最大轮次限制 (${maxTurns})`);
  }

  return currentHistory;
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
