/**
 * Google Gemini 适配器
 */

import { GoogleGenerativeAI, GenerativeModel, Content, Part, SchemaType } from '@google/generative-ai';
import type { Message, ToolDefinition, ToolResult, LLMResponse, ContentBlock } from '../../../core/types.js';
import { ProtocolAdapter } from './base.js';
import type { StreamCallbacks, StreamResult } from './base.js';
import { toolResultContentToText } from '../../../core/toolResult.js';
import { generateUuid } from '../../../utils/uuid.js';

type GeminiFunctionCall = {
  name: string;
  args?: Record<string, unknown>;
};

type GeminiResponsePart = {
  text?: string;
  functionCall?: GeminiFunctionCall;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiResponsePart[];
    };
  }>;
};

export class GeminiAdapter extends ProtocolAdapter {
  private client!: GoogleGenerativeAI;
  private generativeModel!: GenerativeModel;

  async initializeClient(): Promise<void> {
    this.client = new GoogleGenerativeAI(this.apiKey);
    // 注意：Gemini 的 baseURL 配置需要特殊处理，这里简化处理
    this.generativeModel = this.client.getGenerativeModel({ model: this.model });
  }

  convertTools(tools: ToolDefinition[]): unknown[] {
    // 转换 Anthropic 格式 → Gemini FunctionDeclaration 格式
    const declarations = tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: {
        type: SchemaType.OBJECT,
        properties: tool.input_schema.properties,
        required: tool.input_schema.required,
      },
    }));

    return [
      {
        functionDeclarations: declarations,
      },
    ];
  }

  async createMessage(
    system: string,
    messages: Message[],
    tools: unknown[],
    _maxTokens: number
  ): Promise<unknown> {
    // 确保客户端已初始化
    if (!this.generativeModel) {
      await this.initializeClient();
    }

    // 转换消息为 Gemini Content 格式
    const contents: Content[] = [];

    // 系统消息作为第一条用户消息
    if (system) {
      contents.push({
        role: 'user',
        parts: [{ text: system }],
      });
      contents.push({
        role: 'model',
        parts: [{ text: '好的，我明白了。' }],
      });
    }

    // 转换其他消息
    for (const msg of messages) {
      const role = msg.role === 'assistant' ? 'model' : 'user';
      const parts: Part[] = [];

      if (typeof msg.content === 'string') {
        parts.push({ text: msg.content });
      } else {
        for (const block of msg.content) {
          if (block.type === 'text') {
            parts.push({ text: block.text });
          } else if (block.type === 'tool_use') {
            parts.push({
              functionCall: {
                name: block.name,
                args: block.input,
              },
            });
          } else if (block.type === 'tool_result') {
            parts.push({
              functionResponse: {
                name: block.name || 'unknown',
                response: {
                  content: toolResultContentToText(block.content),
                },
              },
            });
          }
        }
      }

      contents.push({ role, parts });
    }

    // 调用 API
    const chat = this.generativeModel.startChat({
      history: contents.slice(0, -1),
      tools: tools as unknown as Array<Record<string, unknown>>,
    });

    const lastMessage = contents[contents.length - 1];
    const result = await chat.sendMessage(lastMessage.parts);

    return result.response;
  }

  extractTextAndToolCalls(response: unknown): LLMResponse {
    const geminiResponse = response as GeminiResponse;
    const textBlocks: string[] = [];
    const toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];

    if (geminiResponse.candidates && geminiResponse.candidates.length > 0) {
      const candidate = geminiResponse.candidates[0];

      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.text) {
            textBlocks.push(part.text);
          } else if (part.functionCall) {
            // 生成伪 ID（Gemini 不提供 ID）
            const id = `gemini_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            toolCalls.push({
              id,
              name: part.functionCall.name,
              input: part.functionCall.args || {},
            });
          }
        }
      }
    }

    return {
      textBlocks,
      toolCalls,
      stopReason: 'stop',
    };
  }

  formatAssistantMessage(response: unknown): Message {
    const geminiResponse = response as GeminiResponse;
    const content: ContentBlock[] = [];

    if (geminiResponse.candidates && geminiResponse.candidates.length > 0) {
      const candidate = geminiResponse.candidates[0];

      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.text) {
            content.push({
              type: 'text',
              text: part.text,
            });
          } else if (part.functionCall) {
            const id = `gemini_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            content.push({
              type: 'tool_use',
              id,
              name: part.functionCall.name,
              input: part.functionCall.args || {},
            });
          }
        }
      }
    }

    return {
      role: 'assistant',
      content,
      uuid: generateUuid(),
    };
  }

  formatToolResults(results: ToolResult[]): Message {
    const content: ContentBlock[] = results.map((r) => ({
      type: 'tool_result' as const,
      tool_use_id: r.tool_use_id,
      content: r.content,
      is_error: r.is_error,
    }));

    return {
      role: 'user',
      content,
      uuid: generateUuid(),
    };
  }

  /**
   * 构建 Gemini Contents 格式（复用逻辑）
   */
  private buildGeminiContents(system: string, messages: Message[]): Content[] {
    const contents: Content[] = [];

    if (system) {
      contents.push({
        role: 'user',
        parts: [{ text: system }],
      });
      contents.push({
        role: 'model',
        parts: [{ text: '好的，我明白了。' }],
      });
    }

    for (const msg of messages) {
      const role = msg.role === 'assistant' ? 'model' : 'user';
      const parts: Part[] = [];

      if (typeof msg.content === 'string') {
        parts.push({ text: msg.content });
      } else {
        for (const block of msg.content) {
          if (block.type === 'text') {
            parts.push({ text: block.text });
          } else if (block.type === 'tool_use') {
            parts.push({
              functionCall: {
                name: block.name,
                args: block.input,
              },
            });
          } else if (block.type === 'tool_result') {
            parts.push({
              functionResponse: {
                name: block.name || 'unknown',
                response: {
                  content: toolResultContentToText(block.content),
                },
              },
            });
          }
        }
      }

      contents.push({ role, parts });
    }

    return contents;
  }

  async createStreamMessage(
    system: string,
    messages: Message[],
    tools: unknown[],
    _maxTokens: number,
    callbacks: StreamCallbacks
  ): Promise<StreamResult> {
    if (!this.generativeModel) {
      await this.initializeClient();
    }

    const contents = this.buildGeminiContents(system, messages);

    const chat = this.generativeModel.startChat({
      history: contents.slice(0, -1),
      tools: tools as unknown as Array<Record<string, unknown>>,
    });

    const lastMessage = contents[contents.length - 1];
    let fullText = '';
    const toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];

    try {
      const result = await chat.sendMessageStream(lastMessage.parts);

      for await (const chunk of result.stream) {
        if (callbacks.signal?.aborted) break;

        const chunkText = chunk.text();
        if (chunkText) {
          fullText += chunkText;
          callbacks.onText?.(chunkText);
        }
      }

      // 获取完整响应以提取函数调用
      const response = await result.response;
      if (response.candidates && response.candidates.length > 0) {
        const candidate = response.candidates[0];
        if (candidate.content && candidate.content.parts) {
          for (const part of candidate.content.parts) {
            if (part.functionCall) {
              const id = `gemini_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
              const toolCall = {
                id,
                name: part.functionCall.name,
                input: (part.functionCall.args || {}) as Record<string, unknown>,
              };
              toolCalls.push(toolCall);
              callbacks.onToolUse?.(toolCall);
            }
          }
        }
      }

      // 获取 usage（如果可用）
      const usageMetadata = response.usageMetadata;
      const usage = usageMetadata ? {
        inputTokens: usageMetadata.promptTokenCount ?? 0,
        outputTokens: usageMetadata.candidatesTokenCount ?? 0,
      } : undefined;
      if (usage) callbacks.onUsage?.(usage);
    } catch (error: unknown) {
      if (callbacks.signal?.aborted) {
        return {
          textBlocks: fullText ? [fullText] : [],
          toolCalls: [],
          stopReason: 'interrupted',
          assistantMessage: {
            role: 'assistant',
            content: fullText ? [{ type: 'text' as const, text: fullText }] : [],
            uuid: generateUuid(),
          },
        };
      }
      throw error;
    }

    // 如果被中断
    if (callbacks.signal?.aborted) {
      return {
        textBlocks: fullText ? [fullText] : [],
        toolCalls: [],
        stopReason: 'interrupted',
      assistantMessage: {
        role: 'assistant',
        content: fullText ? [{ type: 'text' as const, text: fullText }] : [],
        uuid: generateUuid(),
      },
    };
  }

    // 构建 assistant message
    const contentBlocks: ContentBlock[] = [];
    if (fullText) contentBlocks.push({ type: 'text', text: fullText });
    for (const tc of toolCalls) {
      contentBlocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input });
    }

    return {
      textBlocks: fullText ? [fullText] : [],
      toolCalls,
      stopReason: toolCalls.length > 0 ? 'tool_use' : 'stop',
      assistantMessage: { role: 'assistant', content: contentBlocks, uuid: generateUuid() },
    };
  }
  async cloneWithModel(model: string): Promise<ProtocolAdapter> {
    const adapter = new GeminiAdapter(this.apiKey, model, this.baseUrl);
    await adapter.initializeClient();
    return adapter;
  }
}
