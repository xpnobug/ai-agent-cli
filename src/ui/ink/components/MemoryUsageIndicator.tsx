/**
 * MemoryUsageIndicator — 内存/Token 用量指示器
 *
 * 功能：实时显示上下文 Token 使用百分比条。
 */

import React from 'react';
import { Box, Text } from '../primitives.js';

type Props = {
  currentTokens: number;
  maxTokens: number;
};

function getBarColor(percentage: number): string {
  if (percentage >= 90) return 'red';
  if (percentage >= 70) return 'yellow';
  return 'green';
}

export function MemoryUsageIndicator({ currentTokens, maxTokens }: Props): React.ReactNode {
  if (maxTokens <= 0) return null;

  const percentage = Math.min(100, Math.round((currentTokens / maxTokens) * 100));
  const barWidth = 20;
  const filled = Math.round((percentage / 100) * barWidth);
  const empty = barWidth - filled;
  const color = getBarColor(percentage);

  return (
    <Box gap={1}>
      <Text dimColor>ctx</Text>
      <Text color={color}>{'█'.repeat(filled)}</Text>
      <Text dimColor>{'░'.repeat(empty)}</Text>
      <Text color={color} bold>{percentage}%</Text>
    </Box>
  );
}
