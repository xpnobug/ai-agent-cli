/**
 * SessionPreview — 会话预览组件
 *
 * 功能：/resume 命令中展示会话摘要预览。
 */

import React from 'react';
import { Box, Text } from '../primitives.js';
import figures from 'figures';

export interface SessionInfo {
  id: string;
  startedAt: string;
  messageCount: number;
  lastPrompt?: string;
  model?: string;
  provider?: string;
}

type Props = {
  session: SessionInfo;
};

export function SessionPreview({ session }: Props): React.ReactNode {
  return (
    <Box flexDirection="column" borderStyle="round" borderDimColor paddingX={1}>
      <Box gap={2}>
        <Text bold color="cyan">会话 {session.id.slice(0, 8)}</Text>
        <Text dimColor>{session.startedAt}</Text>
      </Box>
      <Box gap={1}>
        <Text dimColor>{figures.pointerSmall} {session.messageCount} 条消息</Text>
        {session.model && <Text dimColor>{figures.pointerSmall} {session.model}</Text>}
      </Box>
      {session.lastPrompt && (
        <Box marginTop={1}>
          <Text dimColor wrap="truncate-end">
            最后输入: {session.lastPrompt.slice(0, 100)}
          </Text>
        </Box>
      )}
    </Box>
  );
}
