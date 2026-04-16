/**
 * MemoryInputMessageView — 记忆写入反馈消息
 *
 * 功能：当 AI 写入记忆文件时显示友好反馈。
 */

import React from 'react';
import figures from 'figures';
import { Box, Text } from '../../primitives.js';
import type { MessageViewProps } from './registry.js';
import { registerMessageView } from './registry.js';
import type { CompletedItem } from '../../types.js';

type MemoryInputItem = Extract<CompletedItem, { type: 'memory_input' }>;

const SAVING_MESSAGES = ['记住了。', '已记录。', '好的，已保存。', '收到。'];
let _msgIndex = 0;

function getSavingMessage(): string {
  return SAVING_MESSAGES[_msgIndex++ % SAVING_MESSAGES.length]!;
}

function MemoryInputMessageView({ item }: MessageViewProps<MemoryInputItem>): React.ReactNode {
  const savingText = getSavingMessage();

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box gap={1}>
        <Text color="green">{figures.tick}</Text>
        <Text dimColor>{savingText}</Text>
      </Box>
      {item.filePath && (
        <Box paddingLeft={3}>
          <Text dimColor>→ {item.filePath}</Text>
        </Box>
      )}
      {item.text && (
        <Box paddingLeft={3}>
          <Text dimColor wrap="truncate-end">{item.text.slice(0, 100)}</Text>
        </Box>
      )}
    </Box>
  );
}

registerMessageView('memory_input', MemoryInputMessageView as any);

export { MemoryInputMessageView };
