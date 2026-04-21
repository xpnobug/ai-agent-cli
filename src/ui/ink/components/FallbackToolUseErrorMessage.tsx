/**
 * FallbackToolUseErrorMessage — 工具执行错误的通用展示
 *
 * - 解析 <tool_use_error> tag，提取实际错误内容
 * - 非 verbose 模式截断到 MAX_RENDERED_LINES 行
 * - 超出行数显示 … +N lines 提示
 */

import React from 'react';
import { Box, Text } from '../primitives.js';
import { MessageResponse } from './MessageResponse.js';
import { getInkColors } from '../../theme.js';

const MAX_RENDERED_LINES = 10;

/** 从字符串中提取 XML tag 内容 */
function extractTag(str: string, tag: string): string | null {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`);
  const m = re.exec(str);
  return m?.[1] ?? null;
}

interface Props {
  result: string | unknown[];
  verbose: boolean;
}

export function FallbackToolUseErrorMessage({ result, verbose }: Props): React.ReactNode {
  let error: string;

  if (typeof result !== 'string') {
    error = 'Tool execution failed';
  } else {
    const extracted = extractTag(result, 'tool_use_error') ?? result;
    // 去掉 <error> tag，保留内容
    const withoutErrorTags = extracted.replace(/<\/?error>/g, '');
    const trimmed = withoutErrorTags.trim();

    if (!verbose && trimmed.includes('InputValidationError: ')) {
      error = 'Invalid tool parameters';
    } else if (trimmed.startsWith('Error: ') || trimmed.startsWith('Cancelled: ')) {
      error = trimmed;
    } else {
      error = `Error: ${trimmed}`;
    }
  }

  const lines = error.split('\n');
  const plusLines = lines.length - MAX_RENDERED_LINES;
  const displayed = verbose ? error : lines.slice(0, MAX_RENDERED_LINES).join('\n');
  const colors = getInkColors();

  return (
    <MessageResponse>
      <Box flexDirection="column">
        <Text color={colors.error}>{displayed}</Text>
        {!verbose && plusLines > 0 && (
          <Box>
            <Text dimColor>… +{plusLines} {plusLines === 1 ? 'line' : 'lines'}</Text>
          </Box>
        )}
      </Box>
    </MessageResponse>
  );
}
