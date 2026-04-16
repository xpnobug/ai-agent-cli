/**
 * ExitFlow — 退出流程组件
 *
 * 功能：退出前显示会话统计摘要。
 */

import React from 'react';
import { Box, Text } from '../primitives.js';
import figures from 'figures';

export interface ExitStats {
  turns: number;
  totalTokens: number;
  totalCost: number;
  durationSeconds: number;
}

type Props = {
  stats?: ExitStats;
  message?: string;
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function ExitFlow({ stats, message }: Props): React.ReactNode {
  return (
    <Box flexDirection="column" marginY={1}>
      <Text dimColor>{figures.line}</Text>
      {message && <Text>{message}</Text>}
      {stats && stats.turns > 0 && (
        <Box gap={2}>
          <Text dimColor>
            {stats.turns} 轮对话 {figures.pointerSmall} {formatTokens(stats.totalTokens)} tokens {figures.pointerSmall} ${stats.totalCost.toFixed(4)} {figures.pointerSmall} {formatDuration(stats.durationSeconds)}
          </Text>
        </Box>
      )}
    </Box>
  );
}
