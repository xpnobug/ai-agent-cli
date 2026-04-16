/**
 * ToolUseLoader — 工具调用加载动画
 *
 * 功能：工具执行中显示加载动画和工具名称。
 */

import React from 'react';
import { Box, Text } from '../primitives.js';
import { SpinnerGlyph } from './Spinner/index.js';

type Props = {
  toolName: string;
  description?: string;
};

export function ToolUseLoader({ toolName, description }: Props): React.ReactNode {
  return (
    <Box gap={1}>
      <SpinnerGlyph preset="dots" color="cyan" />
      <Text bold>{toolName}</Text>
      {description && <Text dimColor>{description}</Text>}
    </Box>
  );
}
