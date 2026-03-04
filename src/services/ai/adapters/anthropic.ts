/**
 * Anthropic Claude 适配器
 */

import Anthropic from '@anthropic-ai/sdk';
import type { Message, ToolDefinition, ToolResult, LLMResponse, ContentBlock, TokenUsage } from '../../../core/types.js';
import { ProtocolAdapter } from './base.js';
import type { StreamCallbacks, StreamResult } from './base.js';
import { generateUuid } from '../../../utils/uuid.js';

const PROMPT_CACHING_ENABLED = !process.env.DISABLE_PROMPT_CACHING;

type CacheControl = { type: 'ephemeral' };
type CacheTextBlock = { type: 'text'; text: string; cache_control?: CacheControl };
type AnthropicMessageParam = {
  role: 'user' | 'assistant';
  content: Array<Record<string, unknown>>;
};

function stripCacheControl(block: Record<string, unknown>): Record<string, unknown> {
  if (block.type !== 'text') return block;
  const { cache_control, ...rest } = block as Record<string, unknown> & { cache_control?: CacheControl };
  return rest;
}

function applyCacheControlWithLimits(
  systemBlocks: CacheTextBlock[],
  messageParams: AnthropicMessageParam[]
): { systemBlocks: CacheTextBlock[]; messageParams: AnthropicMessageParam[] } {
  if (!PROMPT_CACHING_ENABLED) {
    return {
      systemBlocks: systemBlocks.map((block) => stripCacheControl(block) as CacheTextBlock),
      messageParams: messageParams.map((message) => ({
        ...message,
        content: message.content.map((block) => stripCacheControl(block)),
      })),
    };
  }

  const maxCacheBlocks = 4;
  let usedCacheBlocks = 0;

  const processedSystemBlocks = systemBlocks.map((block) => {
    if (usedCacheBlocks < maxCacheBlocks && block.text.length > 1000) {
      usedCacheBlocks++;
      return {
        ...block,
        cache_control: { type: 'ephemeral' as const },
      };
    }
    return stripCacheControl(block) as CacheTextBlock;
  });

  const processedMessageParams = messageParams.map((message, messageIndex) => {
    const processedContent = message.content.map((contentBlock, blockIndex) => {
      const shouldCache =
        usedCacheBlocks < maxCacheBlocks &&
        contentBlock.type === 'text' &&
        typeof contentBlock.text === 'string' &&
        (contentBlock.text.length > 2000 ||
          (messageIndex === messageParams.length - 1 &&
            blockIndex === message.content.length - 1 &&
            contentBlock.text.length > 500));

      if (shouldCache) {
        usedCacheBlocks++;
        return {
          ...contentBlock,
          cache_control: { type: 'ephemeral' as const },
        };
      }

      return stripCacheControl(contentBlock);
    });

    return {
      ...message,
      content: processedContent,
    };
  });

  return {
    systemBlocks: processedSystemBlocks,
    messageParams: processedMessageParams,
  };
}

function buildSystemBlocks(system: string): CacheTextBlock[] {
  return [{ type: 'text', text: system }];
}

function buildAnthropicMessages(messages: Message[]): AnthropicMessageParam[] {
  return messages.map((msg) => {
    if (typeof msg.content === 'string') {
      return {
        role: msg.role,
        content: [{ type: 'text', text: msg.content }],
      };
    }

    const content = msg.content.map((block) => {
      if (block.type === 'text') {
        return { type: 'text', text: block.text };
      }
      if (block.type === 'tool_use') {
        return {
          type: 'tool_use',
          id: block.id,
          name: block.name,
          input: block.input,
        };
      }
      if (block.type === 'tool_result') {
        return {
          type: 'tool_result',
          tool_use_id: block.tool_use_id,
          content: block.content,
          is_error: block.is_error,
        };
      }
      return block as unknown as Record<string, unknown>;
    });

    return {
      role: msg.role,
      content,
    };
  });
}

export class AnthropicAdapter extends ProtocolAdapter {
  private client!: Anthropic;

  async initializeClient(): Promise<void> {
    const options: {
      apiKey: string;
      baseURL?: string;
    } = {
      apiKey: this.apiKey,
    };

    if (this.baseUrl) {
      options.baseURL = this.baseUrl;
    }

    this.client = new Anthropic(options);
  }

  convertTools(tools: ToolDefinition[]): unknown[] {
    // Anthropic 使用原生格式，无需转换
    return tools;
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
    const systemBlocks = buildSystemBlocks(system);
    const anthropicMessages = buildAnthropicMessages(messages);
    const { systemBlocks: processedSystem, messageParams: processedMessages } =
      applyCacheControlWithLimits(systemBlocks, anthropicMessages);

    // 调用 API
    const response = await this.client.messages.create({
      model: this.model,
      system: processedSystem as any,
      messages: processedMessages as any,
      tools: tools as Anthropic.Tool[],
      max_tokens: maxTokens,
    });

    return response;
  }

  extractTextAndToolCalls(response: unknown): LLMResponse {
    const msg = response as Anthropic.Message;
    const textBlocks: string[] = [];
    const toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];

    for (const block of msg.content) {
      if (block.type === 'text') {
        textBlocks.push(block.text);
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        });
      }
    }

    return {
      textBlocks,
      toolCalls,
      stopReason: msg.stop_reason || 'end_turn',
      usage: {
        inputTokens: msg.usage.input_tokens,
        outputTokens: msg.usage.output_tokens,
        cacheCreationTokens: msg.usage.cache_creation_input_tokens ?? undefined,
        cacheReadTokens: msg.usage.cache_read_input_tokens ?? undefined,
      },
    };
  }

  formatAssistantMessage(response: unknown): Message {
    const msg = response as Anthropic.Message;

    return {
      role: 'assistant',
      content: msg.content as ContentBlock[],
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

    const systemBlocks = buildSystemBlocks(system);
    const anthropicMessages = buildAnthropicMessages(messages);
    const { systemBlocks: processedSystem, messageParams: processedMessages } =
      applyCacheControlWithLimits(systemBlocks, anthropicMessages);

    const stream = this.client.messages.stream({
      model: this.model,
      system: processedSystem as any,
      messages: processedMessages as any,
      tools: tools as Anthropic.Tool[],
      max_tokens: maxTokens,
    });

    // 处理中断信号
    if (callbacks.signal) {
      const onAbort = () => { stream.abort(); };
      callbacks.signal.addEventListener('abort', onAbort, { once: true });
    }

    // 收集流式文本
    let collectedText = '';

    stream.on('text', (text) => {
      collectedText += text;
      callbacks.onText?.(text);
    });

    try {
      const finalMessage = await stream.finalMessage();

      // 提取结果
      const textBlocks: string[] = [];
      const toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];

      for (const block of finalMessage.content) {
        if (block.type === 'text') {
          textBlocks.push(block.text);
        } else if (block.type === 'tool_use') {
          const toolCall = {
            id: block.id,
            name: block.name,
            input: block.input as Record<string, unknown>,
          };
          toolCalls.push(toolCall);
          callbacks.onToolUse?.(toolCall);
        }
      }

      const usage: TokenUsage = {
        inputTokens: finalMessage.usage.input_tokens,
        outputTokens: finalMessage.usage.output_tokens,
        cacheCreationTokens: finalMessage.usage.cache_creation_input_tokens ?? undefined,
        cacheReadTokens: finalMessage.usage.cache_read_input_tokens ?? undefined,
      };
      callbacks.onUsage?.(usage);

      return {
        textBlocks,
        toolCalls,
        stopReason: finalMessage.stop_reason || 'end_turn',
        usage,
        assistantMessage: {
          role: 'assistant',
          content: finalMessage.content as ContentBlock[],
          usage,
          uuid: generateUuid(),
        },
      };
    } catch (error: unknown) {
      // 如果是中断导致的错误，返回部分结果
      if (callbacks.signal?.aborted) {
        return {
          textBlocks: collectedText ? [collectedText] : [],
          toolCalls: [],
          stopReason: 'interrupted',
          assistantMessage: {
            role: 'assistant',
            content: collectedText ? [{ type: 'text' as const, text: collectedText }] : [],
            uuid: generateUuid(),
          },
        };
      }
      throw error;
    }
  }
  async cloneWithModel(model: string): Promise<ProtocolAdapter> {
    const adapter = new AnthropicAdapter(this.apiKey, model, this.baseUrl);
    await adapter.initializeClient();
    return adapter;
  }
}
