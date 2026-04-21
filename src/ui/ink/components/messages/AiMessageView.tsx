/**
 * AiMessageView - AI 回复消息展示
 *
 * - ⏺ 前缀（实心圆点）
 * - 顶部元数据行：model（dimColor）+ elapsed（dimColor）
 * - Markdown 渲染
 * - 内联 API 错误处理（无效 key、rate limit、中断等）
 * - marginTop={1}
 */

import { Box, Text } from '../../primitives.js';
import type { CompletedItem } from '../../types.js';
import { registerMessageView, type MessageViewProps } from './registry.js';
import { Markdown } from '../markdown/Markdown.js';
import { MessageModel } from '../MessageModel.js';
import { MessageTimestamp } from '../MessageTimestamp.js';
import { InterruptedByUser } from '../InterruptedByUser.js';
import { MessageResponse } from '../MessageResponse.js';
import { getInkColors } from '../../../theme.js';

type AiMessageItem = Extract<CompletedItem, { type: 'ai_message' }>;

/** 将毫秒转为可读耗时字符串 */
function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ─── API 错误检测 ───

const API_ERROR_PREFIX = 'API Error:';
const INTERRUPTED_MESSAGES = ['AbortError', 'interrupted by user', 'The operation was aborted'];
const INVALID_KEY_PATTERNS = ['invalid_api_key', 'Invalid API key', 'Incorrect API key'];
const RATE_LIMIT_PATTERNS = ['rate_limit', 'Rate limit', 'Too many requests', '429'];
const CREDIT_PATTERNS = ['insufficient_quota', 'billing', 'credit'];

function isInterrupted(text: string): boolean {
  return INTERRUPTED_MESSAGES.some(p => text.includes(p));
}

function isInvalidKey(text: string): boolean {
  return INVALID_KEY_PATTERNS.some(p => text.includes(p));
}

function isRateLimit(text: string): boolean {
  return RATE_LIMIT_PATTERNS.some(p => text.includes(p));
}

function isInsufficientCredit(text: string): boolean {
  return CREDIT_PATTERNS.some(p => text.includes(p));
}

function isApiError(text: string): boolean {
  return text.startsWith(API_ERROR_PREFIX) || text.startsWith('Error:');
}

export function AiMessageView({ item }: MessageViewProps<AiMessageItem>) {
  const text = item.text || '';
  const hasMetadata = item.model || item.elapsed != null || item.timestamp != null;
  const colors = getInkColors();

  // ─── 内联 API 错误分流 ───

  // 用户中断
  if (isInterrupted(text)) {
    return <InterruptedByUser />;
  }

  // 无效 API Key
  if (isInvalidKey(text)) {
    return (
      <MessageResponse>
        <Box flexDirection="column">
          <Text color={colors.error}>API Key 无效或已过期</Text>
          <Text dimColor>请运行 /config set 重新配置 API Key</Text>
        </Box>
      </MessageResponse>
    );
  }

  // Rate Limit
  if (isRateLimit(text)) {
    return (
      <MessageResponse>
        <Box flexDirection="column">
          <Text color={colors.warning}>请求频率超限</Text>
          <Text dimColor>请稍后重试，或升级账户以获取更高配额</Text>
        </Box>
      </MessageResponse>
    );
  }

  // 信用不足
  if (isInsufficientCredit(text)) {
    return (
      <MessageResponse>
        <Box flexDirection="column">
          <Text color={colors.error}>账户额度不足</Text>
          <Text dimColor>请检查账户余额或充值</Text>
        </Box>
      </MessageResponse>
    );
  }

  // 通用 API 错误
  if (isApiError(text)) {
    const errorText = text.slice(0, 500);
    return (
      <MessageResponse>
        <Text color={colors.error}>{errorText}</Text>
      </MessageResponse>
    );
  }

  // 空消息
  if (!text.trim()) {
    return null;
  }

  // ─── 正常渲染 ───

  return (
    <Box marginTop={1} alignItems="flex-start" flexDirection="row" width="100%">
      <Box flexDirection="row">
        <Box minWidth={2}>
          <Text color="white">⏺</Text>
        </Box>
        <Box flexDirection="column" flexGrow={1} flexShrink={1}>
          {hasMetadata && (
            <Box flexDirection="row" gap={1}>
              {item.model && <MessageModel model={item.model} />}
              {item.elapsed != null && (
                <Text dimColor>({formatElapsed(item.elapsed)})</Text>
              )}
              {item.timestamp != null && <MessageTimestamp timestamp={item.timestamp} />}
            </Box>
          )}
          <Markdown>{text}</Markdown>
        </Box>
      </Box>
    </Box>
  );
}

registerMessageView('ai_message', AiMessageView);
