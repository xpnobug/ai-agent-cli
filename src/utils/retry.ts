/**
 * API 请求重试工具 - 指数退避策略
 */

import { DEFAULTS } from '../core/constants.js';

/**
 * 重试配置
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

/**
 * 默认重试配置
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: DEFAULTS.maxRetries,
  initialDelay: DEFAULTS.retryInitialDelay,
  maxDelay: DEFAULTS.retryMaxDelay,
  backoffMultiplier: DEFAULTS.retryBackoffMultiplier,
};

/**
 * 可重试的 HTTP 状态码
 */
const RETRYABLE_STATUS_CODES = [429, 503, 529];

/**
 * 可重试的错误模式
 */
const RETRYABLE_ERROR_PATTERNS = [
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'ENOTFOUND',
  'rate_limit',
  'overloaded',
  'server_error',
  'too_many_requests',
  'capacity',
  'temporarily_unavailable',
  'API_STREAM_TIMEOUT',
];

/**
 * 判断错误是否可重试
 */
export function isRetryableError(error: unknown): boolean {
  if (!error) return false;

  // 检查 HTTP 状态码（API 错误通常包含 status 属性）
  const errorObj = error as Record<string, unknown>;
  if (typeof errorObj.status === 'number') {
    if (RETRYABLE_STATUS_CODES.includes(errorObj.status)) {
      return true;
    }
  }

  // 检查错误消息
  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();

  return RETRYABLE_ERROR_PATTERNS.some(pattern =>
    lowerMessage.includes(pattern.toLowerCase())
  );
}

/**
 * 计算退避延迟（带随机抖动）
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  const baseDelay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt);
  const jitter = baseDelay * 0.1 * Math.random(); // 10% 随机抖动
  return Math.min(baseDelay + jitter, config.maxDelay);
}

/**
 * 延迟指定毫秒
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 带重试的函数执行器
 *
 * @param fn 需要重试的异步函数
 * @param config 重试配置（可选，使用默认值）
 * @param onRetry 重试回调（可选，用于显示重试信息）
 * @returns 函数执行结果
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config?: Partial<RetryConfig>,
  onRetry?: (attempt: number, error: Error, delay: number) => void
): Promise<T> {
  const mergedConfig: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= mergedConfig.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // 最后一次尝试或不可重试的错误，直接抛出
      if (attempt >= mergedConfig.maxRetries || !isRetryableError(error)) {
        throw lastError;
      }

      // 计算延迟
      const delay = calculateDelay(attempt, mergedConfig);

      // 通知调用方即将重试
      if (onRetry) {
        onRetry(attempt + 1, lastError, delay);
      }

      // 等待后重试
      await sleep(delay);
    }
  }

  // 理论上不会到达这里
  throw lastError || new Error('重试失败');
}
