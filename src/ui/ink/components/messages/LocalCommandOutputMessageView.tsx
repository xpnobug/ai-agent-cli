/**
 * LocalCommandOutputMessageView — 斜杠命令输出消息
 *
 * 功能：结构化展示斜杠命令的 stdout/stderr 输出。
 */

import React from 'react';
import { Box, Text } from '../../primitives.js';
import { Markdown } from '../markdown/Markdown.js';
import type { MessageViewProps } from './registry.js';
import { registerMessageView } from './registry.js';
import type { CompletedItem } from '../../types.js';
import { getInkColors } from '../../../theme.js';

type LocalCommandOutputItem = Extract<CompletedItem, { type: 'local_command_output' }>;

function LocalCommandOutputMessageView({ item }: MessageViewProps<LocalCommandOutputItem>): React.ReactNode {
  const hasOutput = item.stdout || item.stderr;
  const colors = getInkColors();

  if (!hasOutput) {
    return (
      <Box marginTop={1}>
        <Text dimColor>(无输出)</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginTop={1} paddingLeft={2}>
      {item.commandName && (
        <Text dimColor bold>/{item.commandName}</Text>
      )}
      {item.stdout && (
        <Box flexDirection="column">
          <Markdown>{item.stdout}</Markdown>
        </Box>
      )}
      {item.stderr && (
        <Box flexDirection="column">
          <Text color={colors.error}>{item.stderr}</Text>
        </Box>
      )}
    </Box>
  );
}

registerMessageView('local_command_output', LocalCommandOutputMessageView as any);

export { LocalCommandOutputMessageView };
