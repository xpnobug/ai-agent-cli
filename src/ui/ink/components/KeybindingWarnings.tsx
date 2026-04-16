/**
 * KeybindingWarnings — 快捷键冲突警告
 *
 * 功能：检测并展示快捷键配置冲突。
 */

import React from 'react';
import figures from 'figures';
import { Box, Text } from '../primitives.js';

export interface KeybindingConflict {
  key: string;
  actions: string[];
  contexts: string[];
}

type Props = {
  conflicts: KeybindingConflict[];
};

export function KeybindingWarnings({ conflicts }: Props): React.ReactNode {
  if (conflicts.length === 0) return null;

  return (
    <Box flexDirection="column" marginY={1}>
      <Text bold color="yellow">{figures.warning} 快捷键冲突</Text>
      {conflicts.map((conflict, i) => (
        <Box key={i} gap={1} paddingLeft={2}>
          <Text color="yellow">{conflict.key}</Text>
          <Text dimColor>→</Text>
          <Text>{conflict.actions.join(' / ')}</Text>
          <Text dimColor>({conflict.contexts.join(', ')})</Text>
        </Box>
      ))}
    </Box>
  );
}
