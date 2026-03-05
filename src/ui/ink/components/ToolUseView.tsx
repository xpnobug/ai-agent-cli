/**
 * ToolUseView - 工具调用展示
 */

import { Box, Text } from 'ink';
import { useEffect, useState } from 'react';
import { getInkColors } from '../../theme.js';
import { UI_SYMBOLS } from '../../../core/constants.js';

export interface ToolUseViewProps {
  name: string;
  detail?: string;
  status: 'queued' | 'running' | 'done' | 'error';
  animate: boolean;
}

export function ToolUseView({ name, detail, status, animate }: ToolUseViewProps) {
  const colors = getInkColors();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!animate) return;
    const timer = setInterval(() => {
      setIsVisible((prev) => !prev);
    }, 600);
    return () => clearInterval(timer);
  }, [animate]);

  const color =
    status === 'error'
      ? colors.error
      : status === 'queued'
        ? colors.textDim
        : colors.success;

  const showDot = !animate || isVisible;
  const showDetail = detail && detail.trim().length > 0;

  return (
    <Box flexDirection="row" flexWrap="wrap">
      <Box minWidth={2}>
        <Text color={color}>{showDot ? UI_SYMBOLS.aiPrefix : '  '}</Text>
      </Box>
      <Text color={color} dimColor={status === 'queued'} bold={status !== 'queued'}>
        {name}
      </Text>
      <Text color={color} dimColor={status === 'queued'}>
        {showDetail ? ` (${detail})` : ''}
      </Text>
      <Text color={color} dimColor={status === 'queued'}>…</Text>
    </Box>
  );
}
