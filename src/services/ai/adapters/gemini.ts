/**
 * Google Gemini 适配器
 */

import { GoogleGenerativeAI, GenerativeModel, Content, Part, SchemaType } from '@google/generative-ai';
import type { Message, ToolDefinition, ToolResult, LLMResponse, ContentBlock } from '../../../core/types.js';
import { ProtocolAdapter } from './base.js';

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
        properties: tool.input_schema.properties as any,
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
                  content: block.content,
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
      tools: tools as any[],
    });

    const lastMessage = contents[contents.length - 1];
    const result = await chat.sendMessage(lastMessage.parts);

    return result.response;
  }

  extractTextAndToolCalls(response: unknown): LLMResponse {
    const geminiResponse = response as any;
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
    const geminiResponse = response as any;
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
    };
  }
}
