/**
 * ShutdownMessageView — 关闭/退出消息展示
 *
 * 功能：会话结束时显示友好的关闭消息。
 */

import React from 'react';
import { Box, Text } from '../../primitives.js';
import type { MessageViewProps } from './registry.js';
import { registerMessageView } from './registry.js';

type ShutdownItem = {
  id: string;
  type: 'shutdown';
  message?: string;
};

const GOODBYE_MESSAGES = ['再见！', '下次见！', '拜拜！', '回头见！'];

function getRandomGoodbye(): string {
  return GOODBYE_MESSAGES[Math.floor(Math.random() * GOODBYE_MESSAGES.length)] ?? '再见！';
}

function ShutdownMessageView({ item }: MessageViewProps<ShutdownItem>): React.ReactNode {
  const message = item.message || getRandomGoodbye();

  return (
    <Box marginY={1}>
      <Text dimColor>{message}</Text>
    </Box>
  );
}

registerMessageView('shutdown', ShutdownMessageView as any);

export { ShutdownMessageView };
