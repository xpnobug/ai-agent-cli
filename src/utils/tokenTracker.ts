/**
 * 精确 Token 追踪器 + 费用计算
 * 基于 API 返回的 usage 数据进行精确统计
 */

import type { TokenUsage } from '../core/types.js';

/**
 * Token 记录
 */
interface TokenRecord {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  timestamp: number;
}

/**
 * 会话统计信息
 */
export interface SessionStats {
  totalInput: number;
  totalOutput: number;
  totalCacheCreation: number;
  totalCacheRead: number;
  totalTokens: number;
  totalCost: number;
  apiCallCount: number;
  sessionDuration: number; // 秒
}

/**
 * 模型定价（每百万 Token 的美元价格）
 */
interface ModelPricing {
  input: number;
  output: number;
  cacheRead?: number;
  cacheCreation?: number;
}

/**
 * 模型定价表
 */
const MODEL_PRICING: Record<string, ModelPricing> = {
  // Anthropic
  'claude-sonnet-4-20250514': { input: 3, output: 15, cacheRead: 0.3, cacheCreation: 3.75 },
  'claude-3-5-sonnet-20241022': { input: 3, output: 15, cacheRead: 0.3, cacheCreation: 3.75 },
  'claude-3-5-haiku-20241022': { input: 1, output: 5, cacheRead: 0.1, cacheCreation: 1.25 },
  'claude-opus-4-20250514': { input: 15, output: 75, cacheRead: 1.5, cacheCreation: 18.75 },
  'claude-3-opus-20240229': { input: 15, output: 75, cacheRead: 1.5, cacheCreation: 18.75 },
  // OpenAI
  'gpt-4o': { input: 2.5, output: 10, cacheRead: 1.25 },
  'gpt-4o-mini': { input: 0.15, output: 0.6, cacheRead: 0.075 },
  'gpt-4-turbo': { input: 10, output: 30 },
  'o1': { input: 15, output: 60, cacheRead: 7.5 },
  'o1-mini': { input: 1.1, output: 4.4, cacheRead: 0.55 },
  'o3-mini': { input: 1.1, output: 4.4, cacheRead: 0.55 },
  // Google
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
  'gemini-2.0-pro': { input: 1.25, output: 10 },
  'gemini-1.5-pro': { input: 1.25, output: 5 },
  'gemini-1.5-flash': { input: 0.075, output: 0.3 },
};

/**
 * Token 追踪器
 */
export class TokenTracker {
  private records: TokenRecord[] = [];
  private model: string;
  private sessionStartTime: number;

  constructor(model: string) {
    this.model = model;
    this.sessionStartTime = Date.now();
  }

  /**
   * 记录一次 API 调用的 Token 使用
   */
  addRecord(usage: TokenUsage): void {
    this.records.push({
      inputTokens: usage.inputTokens || 0,
      outputTokens: usage.outputTokens || 0,
      cacheCreationTokens: usage.cacheCreationTokens || 0,
      cacheReadTokens: usage.cacheReadTokens || 0,
      timestamp: Date.now(),
    });
  }

  /**
   * 获取会话统计
   */
  getStats(): SessionStats {
    let totalInput = 0;
    let totalOutput = 0;
    let totalCacheCreation = 0;
    let totalCacheRead = 0;

    for (const record of this.records) {
      totalInput += record.inputTokens;
      totalOutput += record.outputTokens;
      totalCacheCreation += record.cacheCreationTokens;
      totalCacheRead += record.cacheReadTokens;
    }

    const totalTokens = totalInput + totalOutput + totalCacheCreation + totalCacheRead;
    const totalCost = this.calculateCost(totalInput, totalOutput, totalCacheCreation, totalCacheRead);
    const sessionDuration = (Date.now() - this.sessionStartTime) / 1000;

    return {
      totalInput,
      totalOutput,
      totalCacheCreation,
      totalCacheRead,
      totalTokens,
      totalCost,
      apiCallCount: this.records.length,
      sessionDuration,
    };
  }

  /**
   * 计算费用（美元）
   */
  private calculateCost(
    input: number,
    output: number,
    cacheCreation: number,
    cacheRead: number
  ): number {
    const pricing = this.findPricing();
    if (!pricing) return 0;

    const inputCost = (input / 1_000_000) * pricing.input;
    const outputCost = (output / 1_000_000) * pricing.output;
    const cacheCreationCost = (cacheCreation / 1_000_000) * (pricing.cacheCreation || pricing.input);
    const cacheReadCost = (cacheRead / 1_000_000) * (pricing.cacheRead || pricing.input * 0.1);

    return inputCost + outputCost + cacheCreationCost + cacheReadCost;
  }

  /**
   * 查找模型定价
   */
  private findPricing(): ModelPricing | null {
    // 精确匹配
    if (MODEL_PRICING[this.model]) {
      return MODEL_PRICING[this.model];
    }

    // 部分匹配（model ID 可能包含日期后缀）
    for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
      if (this.model.includes(key) || key.includes(this.model)) {
        return pricing;
      }
    }

    return null;
  }

  /**
   * 格式化统计摘要
   */
  formatSummary(): string {
    const stats = this.getStats();
    const lines: string[] = [];

    lines.push('会话 Token 统计:');
    lines.push(`  输入:       ${formatNumber(stats.totalInput)} tokens${stats.totalCost > 0 ? ` ($${((stats.totalInput / 1_000_000) * (this.findPricing()?.input || 0)).toFixed(4)})` : ''}`);
    lines.push(`  输出:       ${formatNumber(stats.totalOutput)} tokens${stats.totalCost > 0 ? ` ($${((stats.totalOutput / 1_000_000) * (this.findPricing()?.output || 0)).toFixed(4)})` : ''}`);

    if (stats.totalCacheCreation > 0) {
      lines.push(`  缓存创建:   ${formatNumber(stats.totalCacheCreation)} tokens`);
    }
    if (stats.totalCacheRead > 0) {
      lines.push(`  缓存读取:   ${formatNumber(stats.totalCacheRead)} tokens`);
    }

    lines.push(`  总计:       ${formatNumber(stats.totalTokens)} tokens${stats.totalCost > 0 ? ` ($${stats.totalCost.toFixed(4)})` : ''}`);
    lines.push('');
    lines.push(`  API 调用次数: ${stats.apiCallCount}`);

    const minutes = Math.floor(stats.sessionDuration / 60);
    const seconds = Math.round(stats.sessionDuration % 60);
    lines.push(`  会话时长:     ${minutes > 0 ? `${minutes} 分 ` : ''}${seconds} 秒`);

    return lines.join('\n');
  }

  /**
   * 重置统计
   */
  reset(): void {
    this.records = [];
    this.sessionStartTime = Date.now();
  }

  /**
   * 更新模型（用于运行时切换模型）
   */
  setModel(model: string): void {
    this.model = model;
  }
}

/**
 * 格式化数字为千分位格式
 */
function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

// 全局单例
let globalTracker: TokenTracker | null = null;

/**
 * 获取全局 TokenTracker 实例
 */
export function getTokenTracker(model?: string): TokenTracker {
  if (!globalTracker) {
    globalTracker = new TokenTracker(model || 'unknown');
  }
  return globalTracker;
}

/**
 * 初始化全局 TokenTracker
 */
export function initTokenTracker(model: string): TokenTracker {
  globalTracker = new TokenTracker(model);
  return globalTracker;
}
