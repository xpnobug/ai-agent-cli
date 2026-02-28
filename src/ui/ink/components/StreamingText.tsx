/**
 * StreamingText - 流式 AI 响应显示组件
 *
 * 两列布局：固定宽度 ● 前缀 + 自适应文本区域
 * 多行文本自动与首行文字对齐
 */

import { Box, Text } from 'ink';
import { UI_SYMBOLS } from '../../../core/constants.js';
import { getInkColors } from '../../theme.js';

export interface StreamingTextProps {
  text: string;
}

export function StreamingText({ text }: StreamingTextProps) {
  const colors = getInkColors();

  return (
    <Box marginTop={1}>
      <Box flexShrink={0} width={2}>
        <Text color={colors.secondary}>{UI_SYMBOLS.aiPrefix}</Text>
      </Box>
      <Box flexGrow={1} flexShrink={1}>
        <Text>{text}<Text color={colors.cursor}>▊</Text></Text>
      </Box>
    </Box>
  );
}
