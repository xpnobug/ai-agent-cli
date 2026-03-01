/**
 * RequestStatusIndicator - 请求状态指示器
 * ✱ Thinking… (4s · ↓ 4.4k tokens · thinking)
 */

import { Box, Text } from 'ink';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getInkColors, isAccessibilityMode } from '../../theme.js';
import type { TokenStatsSnapshot } from './EnhancedSpinner.js';
import {
  getRequestStatus,
  subscribeRequestStatus,
  type RequestStatus,
} from '../requestStatus.js';

const CHARACTERS =
  process.platform === 'darwin'
    ? ['·', '✢', '✳', '✻', '✽']
    : ['·', '✢', '*', '✻', '✽'];

function getLabel(status: RequestStatus): string {
  switch (status.kind) {
    case 'thinking':
      return 'Thinking';
    case 'streaming':
      return 'Streaming';
    case 'tool':
      return status.detail ? `Running tool: ${status.detail}` : 'Running tool';
    case 'idle':
      return 'Working';
  }
}

function formatElapsed(seconds: number): string {
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
  }
  return `${Math.round(seconds)}s`;
}

function formatTokens(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return String(count);
}

export interface RequestStatusIndicatorProps {
  getTokenStats?: () => TokenStatsSnapshot;
}

export function RequestStatusIndicator({
  getTokenStats,
}: RequestStatusIndicatorProps): ReactNode {
  const frames = useMemo(
    () => [...CHARACTERS, ...[...CHARACTERS].reverse()],
    []
  );
  const colors = getInkColors();

  const [frame, setFrame] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [status, setStatus] = useState<RequestStatus>(() => getRequestStatus());

  const requestStartTime = useRef<number | null>(null);

  useEffect(() => {
    return subscribeRequestStatus((next) => {
      setStatus(next);
      if (next.kind !== 'idle' && requestStartTime.current === null) {
        requestStartTime.current = Date.now();
      }
      if (next.kind === 'idle') {
        requestStartTime.current = null;
        setElapsedTime(0);
      }
    });
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((f) => (f + 1) % frames.length);
    }, 120);
    return () => clearInterval(timer);
  }, [frames.length]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (requestStartTime.current === null) {
        setElapsedTime(0);
        return;
      }
      setElapsedTime(
        Math.floor((Date.now() - requestStartTime.current) / 1000)
      );
    }, 250);
    return () => clearInterval(timer);
  }, []);

  if (isAccessibilityMode()) {
    const liveStats = getTokenStats?.();
    const tokenCount = liveStats?.totalTokens;
    const tokenText = tokenCount ? ` · ↓ ${formatTokens(tokenCount)} tokens` : '';
    return (
      <Text>
        [处理中] {getLabel(status)} ({formatElapsed(elapsedTime)}
        {tokenText} · esc to interrupt)
      </Text>
    );
  }

  const liveStats = getTokenStats?.();
  const tokenCount = liveStats?.totalTokens;

  const parts: string[] = [];
  parts.push(formatElapsed(elapsedTime));
  if (tokenCount) parts.push(`↓ ${formatTokens(tokenCount)} tokens`);
  parts.push('esc to interrupt');
  const stats = parts.join(' · ');

  return (
    <Box marginTop={1}>
      <Box flexWrap="nowrap" height={1} width={2}>
        <Text color={colors.primary}>{frames[frame]}</Text>
      </Box>
      <Text dimColor>
        {getLabel(status)}… ({stats})
      </Text>
    </Box>
  );
}
