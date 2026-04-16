/**
 * PromptInputModeIndicator — 输入模式指示器
 *
 * 功能：在输入框前显示当前模式的视觉指示符。
 *   - Normal (prompt): ❯
 *   - Plan 模式: ❯ (黄色)
 *   - 加载中: ❯ (暗色)
 */

import React from 'react';
import figures from 'figures';
import { Box, Text } from '../primitives.js';
import type { PromptInputMode } from './PromptInput/inputModes.js';

export type { PromptInputMode };

type Props = {
  mode: PromptInputMode;
  isLoading: boolean;
};

export function PromptInputModeIndicator({ mode, isLoading }: Props): React.ReactNode {
  const color = mode === 'plan' ? 'yellow' : mode === 'bash' ? 'yellow' : undefined;
  const char = mode === 'bash' ? '!' : figures.pointer;

  return (
    <Box alignItems="flex-start" flexShrink={0} width={2}>
      <Text color={color} dimColor={isLoading} bold>
        {char}
      </Text>
    </Box>
  );
}
