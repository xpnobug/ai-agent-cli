/**
 * 协议适配器基类
 * 定义 LLM API 的统一接口
 */

import type { Message, ToolDefinition, ToolResult, ToolCall } from '../../../core/types.js';

/**
 * 协议适配器抽象基类
 */
export abstract class ProtocolAdapter {
  protected apiKey: string;
  protected model: string;
  protected baseUrl?: string;

  constructor(apiKey: string, model: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl;
  }

  /**
   * 初始化客户端
   */
  abstract initializeClient(): Promise<void>;

  /**
   * 创建消息（调用 LLM API）
   */
  abstract createMessage(
    systemPrompt: string,
    messages: Message[],
    tools: unknown[],
    maxTokens: number
  ): Promise<unknown>;

  /**
   * 转换工具定义为提供商格式
   */
  abstract convertTools(tools: ToolDefinition[]): unknown[];

  /**
   * 从响应中提取文本块和工具调用
   */
  abstract extractTextAndToolCalls(response: unknown): {
    textBlocks: string[];
    toolCalls: ToolCall[];
    stopReason: string;
  };

  /**
   * 格式化助手消息
   */
  abstract formatAssistantMessage(response: unknown): Message;

  /**
   * 格式化工具结果
   */
  abstract formatToolResults(results: ToolResult[]): Message;

  /**
   * 获取模型名称
   */
  getModel(): string {
    return this.model;
  }
}
