/**
 * OpenAI 适配器
 */

import OpenAI from 'openai';
import type { Message, ToolDefinition, ToolResult, LLMResponse, ContentBlock, TokenUsage } from '../../../core/types.js';
import { ProtocolAdapter } from './base.js';
import type { StreamCallbacks, StreamResult } from './base.js';
import { toolResultContentToText } from '../../../core/toolResult.js';

export class OpenAIAdapter extends ProtocolAdapter {
  private client!: OpenAI;

  async initializeClient(): Promise<void> {
    const options: { apiKey: string; baseURL?: string } = {
      apiKey: this.apiKey,
    };

    if (this.baseUrl) {
      options.baseURL = this.baseUrl;
    }

    this.client = new OpenAI(options);
  }

  convertTools(tools: ToolDefinition[]): unknown[] {
    // 转换 Anthropic 格式 → OpenAI 格式
    return tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
      },
    }));
  }

  async createMessage(
    system: string,
    messages: Message[],
    tools: unknown[],
    maxTokens: number
  ): Promise<unknown> {
    // 确保客户端已初始化
    if (!this.client) {
      await this.initializeClient();
    }

    // 转换消息格式
    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      // 系统消息单独处理
      { role: 'system', content: system },
    ];

    // 转换其他消息
    for (const msg of messages) {
      if (msg.role === 'assistant') {
        // 助手消息可能包含工具调用
        if (typeof msg.content === 'string') {
          openaiMessages.push({
            role: 'assistant',
            content: msg.content,
          });
        } else {
          // 处理复杂内容
          const textParts: string[] = [];
          const toolCalls: OpenAI.Chat.ChatCompletionMessageToolCall[] = [];

          for (const block of msg.content) {
            if (block.type === 'text') {
              textParts.push(block.text);
            } else if (block.type === 'tool_use') {
              toolCalls.push({
                id: block.id,
                type: 'function',
                function: {
                  name: block.name,
                  arguments: JSON.stringify(block.input),
                },
              });
            }
          }

          openaiMessages.push({
            role: 'assistant',
            content: textParts.join('\n\n') || null,
            tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
          });
        }
      } else if (msg.role === 'user') {
        // 用户消息可能包含工具结果
        if (typeof msg.content === 'string') {
          openaiMessages.push({
            role: 'user',
            content: msg.content,
          });
        } else {
          // 处理工具结果
          for (const block of msg.content) {
            if (block.type === 'tool_result') {
              openaiMessages.push({
                role: 'tool',
                content: toolResultContentToText(block.content),
                tool_call_id: block.tool_use_id,
              });
            } else if (block.type === 'text') {
              openaiMessages.push({
                role: 'user',
                content: block.text,
              });
            }
          }
        }
      }
    }

    // 调用 API
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: openaiMessages,
      tools: tools as OpenAI.Chat.ChatCompletionTool[],
      max_tokens: maxTokens,
    });

    return response;
  }

  extractTextAndToolCalls(response: unknown): LLMResponse {
    const completion = response as OpenAI.Chat.ChatCompletion;
    const choice = completion.choices[0];
    const message = choice.message;

    const textBlocks: string[] = [];
    if (message.content) {
      textBlocks.push(message.content);
    }

    const toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];
    if (message.tool_calls) {
      for (const toolCall of message.tool_calls) {
        toolCalls.push({
          id: toolCall.id,
          name: toolCall.function.name,
          input: JSON.parse(toolCall.function.arguments),
        });
      }
    }

    return {
      textBlocks,
      toolCalls,
      stopReason: choice.finish_reason || 'stop',
      usage: completion.usage ? {
        inputTokens: completion.usage.prompt_tokens,
        outputTokens: completion.usage.completion_tokens,
      } : undefined,
    };
  }

  formatAssistantMessage(response: unknown): Message {
    const completion = response as OpenAI.Chat.ChatCompletion;
    const message = completion.choices[0].message;

    const content: ContentBlock[] = [];

    // 添加文本内容
    if (message.content) {
      content.push({
        type: 'text',
        text: message.content,
      });
    }

    // 添加工具调用
    if (message.tool_calls) {
      for (const toolCall of message.tool_calls) {
        content.push({
          type: 'tool_use',
          id: toolCall.id,
          name: toolCall.function.name,
          input: JSON.parse(toolCall.function.arguments),
        });
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

  /**
   * 构建 OpenAI 消息格式（复用逻辑）
   */
  private buildOpenAIMessages(
    system: string,
    messages: Message[]
  ): OpenAI.Chat.ChatCompletionMessageParam[] {
    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: system },
    ];

    for (const msg of messages) {
      if (msg.role === 'assistant') {
        if (typeof msg.content === 'string') {
          openaiMessages.push({ role: 'assistant', content: msg.content });
        } else {
          const textParts: string[] = [];
          const toolCalls: OpenAI.Chat.ChatCompletionMessageToolCall[] = [];

          for (const block of msg.content) {
            if (block.type === 'text') {
              textParts.push(block.text);
            } else if (block.type === 'tool_use') {
              toolCalls.push({
                id: block.id,
                type: 'function',
                function: {
                  name: block.name,
                  arguments: JSON.stringify(block.input),
                },
              });
            }
          }

          openaiMessages.push({
            role: 'assistant',
            content: textParts.join('\n\n') || null,
            tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
          });
        }
      } else if (msg.role === 'user') {
        if (typeof msg.content === 'string') {
          openaiMessages.push({ role: 'user', content: msg.content });
        } else {
          for (const block of msg.content) {
            if (block.type === 'tool_result') {
              openaiMessages.push({
                role: 'tool',
                content: toolResultContentToText(block.content),
                tool_call_id: block.tool_use_id,
              });
            } else if (block.type === 'text') {
              openaiMessages.push({ role: 'user', content: block.text });
            }
          }
        }
      }
    }

    return openaiMessages;
  }

  async createStreamMessage(
    system: string,
    messages: Message[],
    tools: unknown[],
    maxTokens: number,
    callbacks: StreamCallbacks
  ): Promise<StreamResult> {
    if (!this.client) {
      await this.initializeClient();
    }

    const openaiMessages = this.buildOpenAIMessages(system, messages);

    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: openaiMessages,
      tools: tools as OpenAI.Chat.ChatCompletionTool[],
      max_tokens: maxTokens,
      stream: true,
      stream_options: { include_usage: true },
    });

    let textContent = '';
    const toolCallMap = new Map<number, { id: string; name: string; arguments: string }>();
    let finishReason = 'stop';
    let promptTokens = 0;
    let completionTokens = 0;

    try {
      for await (const chunk of stream) {
        if (callbacks.signal?.aborted) break;

        const choice = chunk.choices[0];
        if (!choice) {
          // usage-only chunk（stream_options 模式下最后一个 chunk）
          if (chunk.usage) {
            promptTokens = chunk.usage.prompt_tokens;
            completionTokens = chunk.usage.completion_tokens ?? 0;
          }
          continue;
        }

        if (choice.finish_reason) {
          finishReason = choice.finish_reason;
        }

        const delta = choice.delta;
        if (delta?.content) {
          textContent += delta.content;
          callbacks.onText?.(delta.content);
        }

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const existing = toolCallMap.get(tc.index) || { id: '', name: '', arguments: '' };
            if (tc.id) existing.id = tc.id;
            if (tc.function?.name) existing.name = tc.function.name;
            if (tc.function?.arguments) existing.arguments += tc.function.arguments;
            toolCallMap.set(tc.index, existing);
          }
        }
      }
    } catch (error: unknown) {
      if (callbacks.signal?.aborted) {
        return {
          textBlocks: textContent ? [textContent] : [],
          toolCalls: [],
          stopReason: 'interrupted',
          assistantMessage: {
            role: 'assistant',
            content: textContent ? [{ type: 'text' as const, text: textContent }] : [],
          },
        };
      }
      throw error;
    }

    // 如果被中断
    if (callbacks.signal?.aborted) {
      return {
        textBlocks: textContent ? [textContent] : [],
        toolCalls: [],
        stopReason: 'interrupted',
        assistantMessage: {
          role: 'assistant',
          content: textContent ? [{ type: 'text' as const, text: textContent }] : [],
        },
      };
    }

    const textBlocks = textContent ? [textContent] : [];
    const toolCalls = Array.from(toolCallMap.values()).map((tc) => ({
      id: tc.id,
      name: tc.name,
      input: JSON.parse(tc.arguments || '{}'),
    }));

    // 通知工具调用
    for (const tc of toolCalls) {
      callbacks.onToolUse?.(tc);
    }

    // 构建 assistant message
    const content: ContentBlock[] = [];
    if (textContent) {
      content.push({ type: 'text', text: textContent });
    }
    for (const tc of toolCalls) {
      content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input });
    }

    const usage: TokenUsage | undefined = (promptTokens || completionTokens)
      ? { inputTokens: promptTokens, outputTokens: completionTokens }
      : undefined;

    if (usage) callbacks.onUsage?.(usage);

    return {
      textBlocks,
      toolCalls,
      stopReason: finishReason === 'tool_calls' ? 'tool_calls' : finishReason,
      usage,
      assistantMessage: { role: 'assistant', content, usage },
    };
  }
}
