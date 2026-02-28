/**
 * 上下文压缩系统
 * 当对话历史接近上下文窗口限制时，自动压缩早期消息
 */

import type { Message } from './types.js';
import type { ProtocolAdapter } from '../services/ai/adapters/base.js';

/**
 * 压缩配置
 */
export interface CompactionConfig {
  /** 触发压缩的上下文使用百分比（默认 80） */
  threshold: number;
  /** 保留最近 N 条消息不参与压缩（默认 4） */
  preserveLastN: number;
  /** 摘要的最大 token 数（默认 2000） */
  summaryMaxTokens: number;
}

/**
 * 压缩结果
 */
export interface CompactionResult {
  newHistory: Message[];
  originalLength: number;
  compressedLength: number;
  summary: string;
}

/**
 * 默认压缩配置
 */
const DEFAULT_CONFIG: CompactionConfig = {
  threshold: 80,
  preserveLastN: 4,
  summaryMaxTokens: 2000,
};

/**
 * 摘要生成模板
 */
const SUMMARY_PROMPT = `请将以下对话历史压缩为一个结构化的摘要。摘要应包含以下几个部分：

1. **请求意图**: 用户最初的请求和目标
2. **技术概念**: 讨论中涉及的关键技术概念和术语
3. **文件和代码**: 涉及的文件路径、函数名、类名等关键代码引用
4. **错误与修复**: 遇到的错误及其解决方案
5. **已实施的方案**: 已经完成的更改和实现
6. **用户偏好**: 用户表达的偏好和决定
7. **任务进度**: 整体任务的完成状态
8. **当前工作**: 最近正在进行的工作
9. **下一步**: 接下来需要完成的工作

请以简洁、信息密集的方式撰写，确保不丢失关键上下文。`;

/**
 * 上下文压缩器
 */
export class ContextCompressor {
  private adapter: ProtocolAdapter;
  private modelContextLength: number;
  private config: CompactionConfig;

  constructor(
    adapter: ProtocolAdapter,
    modelContextLength: number,
    config?: Partial<CompactionConfig>
  ) {
    this.adapter = adapter;
    this.modelContextLength = modelContextLength;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 检查是否需要压缩
   */
  shouldCompact(history: Message[]): boolean {
    // 估算当前 token 使用量
    const estimatedTokens = this.estimateTokens(history);
    const usage = (estimatedTokens / this.modelContextLength) * 100;
    return usage >= this.config.threshold;
  }

  /**
   * 执行压缩
   */
  async compact(history: Message[], systemPrompt: string): Promise<CompactionResult> {
    const preserveCount = this.config.preserveLastN;

    // 如果历史太短，不需要压缩
    if (history.length <= preserveCount + 1) {
      return {
        newHistory: history,
        originalLength: history.length,
        compressedLength: history.length,
        summary: '',
      };
    }

    // 分割：需要压缩的早期消息 + 保留的最近消息
    const toCompress = history.slice(0, -preserveCount);
    const toPreserve = history.slice(-preserveCount);

    // 生成摘要
    const summary = await this.generateSummary(toCompress, systemPrompt);

    // 构建新的历史
    const summaryMessage: Message = {
      role: 'user',
      content: `[上下文摘要]\n\n以下是之前对话的压缩摘要：\n\n${summary}\n\n---\n请基于以上上下文继续对话。`,
    };

    const newHistory: Message[] = [summaryMessage, ...toPreserve];

    return {
      newHistory,
      originalLength: history.length,
      compressedLength: newHistory.length,
      summary,
    };
  }

  /**
   * 生成对话摘要
   */
  private async generateSummary(messages: Message[], _systemPrompt: string): Promise<string> {
    try {
      // 将消息格式化为文本
      const conversationText = messages
        .map((msg) => {
          const role = msg.role === 'user' ? '用户' : '助手';
          const content = typeof msg.content === 'string'
            ? msg.content
            : msg.content
              .filter((block) => block.type === 'text')
              .map((block) => ('text' in block ? block.text : ''))
              .join('\n');

          // 截断过长的单条消息
          const truncated = content.length > 3000
            ? content.slice(0, 3000) + '\n...(已截断)'
            : content;

          return `[${role}]: ${truncated}`;
        })
        .join('\n\n');

      // 调用 LLM 生成摘要
      const summaryMessages: Message[] = [
        {
          role: 'user',
          content: `${SUMMARY_PROMPT}\n\n---\n\n对话历史:\n\n${conversationText}`,
        },
      ];

      const rawResponse = await this.adapter.createMessage(
        '你是一个对话摘要助手。你的任务是准确、简洁地总结对话内容，保留所有关键技术细节。',
        summaryMessages,
        this.adapter.convertTools([]),
        this.config.summaryMaxTokens
      );

      const { textBlocks } = this.adapter.extractTextAndToolCalls(rawResponse);

      if (textBlocks.length > 0) {
        return textBlocks.join('\n\n');
      }

      // 降级：简单截断
      return this.fallbackSummary(messages);
    } catch (error: unknown) {
      // LLM 调用失败时降级
      return this.fallbackSummary(messages);
    }
  }

  /**
   * 降级摘要（不使用 LLM）
   */
  private fallbackSummary(messages: Message[]): string {
    const lines: string[] = ['[自动摘要 - LLM 不可用]', ''];

    // 只保留关键信息
    for (const msg of messages) {
      const role = msg.role === 'user' ? '用户' : '助手';
      const content = typeof msg.content === 'string'
        ? msg.content
        : msg.content
          .filter((block) => block.type === 'text')
          .map((block) => ('text' in block ? block.text : ''))
          .join('\n');

      // 只保留每条消息的前 200 字符
      const summary = content.slice(0, 200);
      lines.push(`[${role}]: ${summary}${content.length > 200 ? '...' : ''}`);
    }

    return lines.join('\n');
  }

  /**
   * 估算消息的 token 数
   * 简单估算：中文约 2 字符/token，英文约 4 字符/token，取平均 3 字符/token
   */
  private estimateTokens(history: Message[]): number {
    let totalChars = 0;

    for (const msg of history) {
      if (typeof msg.content === 'string') {
        totalChars += msg.content.length;
      } else {
        for (const block of msg.content) {
          if (block.type === 'text') {
            totalChars += block.text.length;
          } else if (block.type === 'tool_use') {
            totalChars += JSON.stringify(block.input).length;
          } else if (block.type === 'tool_result') {
            totalChars += block.content.length;
          }
        }
      }

      // 如果有 token 使用统计，直接使用
      if (msg.usage) {
        return msg.usage.inputTokens + msg.usage.outputTokens;
      }
    }

    return Math.ceil(totalChars / 3);
  }
}
