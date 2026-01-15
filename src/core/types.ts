/**
 * AI Agent 核心类型定义
 */

// 消息内容可以是字符串或内容块数组
export type MessageContent = string | ContentBlock[];

// 内容块类型
export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
  name?: string;
}

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

// 消息结构
export interface Message {
  role: 'user' | 'assistant';
  content: MessageContent;
}

// 从响应中提取的工具调用
export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

// 工具定义（Anthropic 格式）
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

// 工具执行结果
export interface ToolResult {
  tool_use_id: string;
  content: string;
  is_error?: boolean;
  name?: string;
}

// 工具执行函数类型
export type ExecuteToolFunc = (
  toolName: string,
  input: Record<string, unknown>
) => Promise<string>;

// LLM 响应
export interface LLMResponse {
  textBlocks: string[];
  toolCalls: ToolCall[];
  stopReason: string;
}

// 提供商类型
export type Provider = 'anthropic' | 'openai' | 'gemini';

// 子代理类型
export type AgentType = 'explore' | 'code' | 'plan';
