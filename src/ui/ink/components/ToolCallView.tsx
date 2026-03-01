/**
 * ToolCallView - 工具调用显示组件
 *
 * Claude Code 风格：
 * - Bash 类：● Bash(command)  ⎿  output
 * - 其他类：● ToolName detail (ctrl+o to expand)
 * - 多行结果截断：⎿  首行 … +N lines (ctrl+o to expand)
 */

import { Box, Text } from 'ink';
import { UI_SYMBOLS } from '../../../core/constants.js';
import { getInkColors } from '../../theme.js';

export interface ToolCallViewProps {
  name: string;
  detail?: string;
  result?: string;
  isError?: boolean;
  mergedCount?: number;
}

/** 格式化工具结果：首行 + 多行截断提示 */
function formatResult(result: string): { firstLine: string; extraLines: number } {
  const lines = result.split('\n');
  const firstLine = lines[0]!.slice(0, 120);
  const extraLines = lines.length - 1;
  return { firstLine, extraLines };
}

export function ToolCallView({ name, detail, result, isError, mergedCount }: ToolCallViewProps) {
  const colors = getInkColors();

  // 合并显示：● read_file 5 files (ctrl+o to expand)
  if (mergedCount && mergedCount > 1) {
    return (
      <Box flexDirection="column">
        <Text>
          <Text color={colors.secondary}>
            {UI_SYMBOLS.aiPrefix}
          </Text>
          {' '}
          <Text bold>{name} {mergedCount} files</Text>
          <Text dimColor> (ctrl+o to expand)</Text>
        </Text>
      </Box>
    );
  }

  // Bash 风格：● Bash(command)
  const isBash = name.toLowerCase() === 'bash';
  const titleText = isBash && detail
    ? `${name}(${detail})`
    : detail
      ? `${name} ${detail}`
      : name;

  // 无结果时显示 (ctrl+o to expand)
  const showExpand = !result;

  return (
    <Box flexDirection="column">
      <Text>
        <Text color={isError ? colors.error : colors.secondary}>
          {UI_SYMBOLS.aiPrefix}
        </Text>
        {' '}
        <Text bold>{titleText}</Text>
        {showExpand && (
          <Text dimColor> (ctrl+o to expand)</Text>
        )}
      </Text>
      {result && (() => {
        const { firstLine, extraLines } = formatResult(result);
        return (
          <>
            <Text dimColor>  {UI_SYMBOLS.toolOutput}  {firstLine}</Text>
            {extraLines > 0 && (
              <Text dimColor>  … +{extraLines} lines (ctrl+o to expand)</Text>
            )}
          </>
        );
      })()}
    </Box>
  );
}
