/**
 * HookProgressMessageView — Hook 执行进度消息
 *
 * 功能：显示 Hook（SessionStart/UserPromptSubmit 等）的执行状态。
 */

import React from 'react';
import figures from 'figures';
import { Box, Text } from '../../primitives.js';
import type { MessageViewProps } from './registry.js';
import { registerMessageView } from './registry.js';
import type { CompletedItem } from '../../types.js';

type HookProgressItem = Extract<CompletedItem, { type: 'hook_progress' }>;

function HookProgressMessageView({ item }: MessageViewProps<HookProgressItem>): React.ReactNode {
  const icon =
    item.status === 'done' ? figures.tick
    : item.status === 'error' ? figures.cross
    : figures.pointer;
  const color =
    item.status === 'done' ? 'green'
    : item.status === 'error' ? 'red'
    : 'yellow';

  return (
    <Box gap={1} marginTop={1}>
      <Text color={color}>{icon}</Text>
      <Text dimColor>Hook</Text>
      <Text bold>{item.hookName}</Text>
      {item.message && <Text dimColor>{item.message}</Text>}
      {item.elapsed != null && (
        <Text dimColor>({(item.elapsed / 1000).toFixed(1)}s)</Text>
      )}
    </Box>
  );
}

registerMessageView('hook_progress', HookProgressMessageView as any);

export { HookProgressMessageView };
