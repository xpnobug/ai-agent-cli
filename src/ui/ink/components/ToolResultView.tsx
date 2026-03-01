/**
 * ToolResultView - 工具结果展示
 */

import path from 'node:path';
import { Box, Text } from 'ink';
import { UI_SYMBOLS, TOOL_CANCEL_MESSAGE, TOOL_REJECT_MESSAGE } from '../../../core/constants.js';
import { getInkColors } from '../../theme.js';
import { HighlightedCode } from './HighlightedCode.js';

export interface ToolResultViewProps {
  name: string;
  content: string;
  isError?: boolean;
  input?: Record<string, unknown>;
}

const MAX_RENDERED_LINES = 10;
const MAX_READ_FILE_LINES = 5;

function stripReadFileSummary(raw: string): string {
  return raw.replace(/\n*\[显示第\s+\d+-\d+\s+行，共\s+\d+\s+行\]\s*$/g, '');
}

function stripLineNumbers(raw: string): string {
  return raw
    .split('\n')
    .map((line) => line.replace(/^\d+→/, ''))
    .join('\n');
}

function getReadFileLanguage(input?: Record<string, unknown>): string {
  const filePath =
    typeof input?.file_path === 'string'
      ? input.file_path
      : typeof input?.path === 'string'
        ? input.path
        : '';
  const ext = path.extname(filePath).slice(1);
  return ext || 'plaintext';
}

export function ToolResultView({ name, content, isError, input }: ToolResultViewProps) {
  const colors = getInkColors();
  const trimmed = content.trim();

  if (trimmed === TOOL_CANCEL_MESSAGE) {
    return (
      <Text>
        &nbsp;&nbsp;{UI_SYMBOLS.toolOutput} &nbsp;
        <Text color={colors.error}>Interrupted by user</Text>
      </Text>
    );
  }

  if (trimmed === TOOL_REJECT_MESSAGE) {
    return (
      <Text>
        &nbsp;&nbsp;{UI_SYMBOLS.toolOutput} &nbsp;
        <Text color={colors.error}>Permission denied</Text>
      </Text>
    );
  }

  const isReadFile = name.toLowerCase() === 'read_file';

  if (isReadFile && !isError) {
    const cleaned = stripLineNumbers(stripReadFileSummary(content));
    const contentWithFallback = cleaned.trim() ? cleaned : '(No content)';
    if (contentWithFallback === 'Read image' || contentWithFallback === 'Read pdf') {
      return (
        <Text>
          &nbsp;&nbsp;{UI_SYMBOLS.toolOutput} &nbsp;
          <Text dimColor>{contentWithFallback}</Text>
        </Text>
      );
    }
    const lines = contentWithFallback.split('\n');
    const shownLines = lines
      .slice(0, MAX_READ_FILE_LINES)
      .filter((line) => line.trim() !== '')
      .join('\n');
    const extraLines = Math.max(0, lines.length - MAX_READ_FILE_LINES);
    const language = getReadFileLanguage(input);

    return (
      <Box flexDirection="row" width="100%">
        <Text>
          &nbsp;&nbsp;{UI_SYMBOLS.toolOutput} &nbsp;
        </Text>
        <Box flexDirection="column">
          <HighlightedCode code={shownLines || '(No content)'} language={language} />
          {extraLines > 0 && (
            <Text dimColor>... (+{extraLines} lines)</Text>
          )}
        </Box>
      </Box>
    );
  }

  const lines = trimmed ? trimmed.split('\n') : [''];
  const shownLines = lines.slice(0, MAX_RENDERED_LINES).join('\n');
  const extraLines = Math.max(0, lines.length - MAX_RENDERED_LINES);

  return (
    <Box flexDirection="row" width="100%">
      <Text>
        &nbsp;&nbsp;{UI_SYMBOLS.toolOutput} &nbsp;
      </Text>
      <Box flexDirection="column">
        <Text color={isError ? colors.error : undefined} dimColor={!isError}>
          {shownLines}
        </Text>
        {extraLines > 0 && (
          <Text dimColor>... (+{extraLines} lines)</Text>
        )}
      </Box>
    </Box>
  );
}
