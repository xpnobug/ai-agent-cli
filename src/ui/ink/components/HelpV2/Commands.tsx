/**
 * HelpV2/Commands — 命令列表面板
 *
 */

import React, { useMemo } from 'react';
import { Box, Text } from '../../primitives.js';

type CommandDef = {
  name: string;
  description: string;
};

type Props = {
  commands: CommandDef[];
  maxHeight: number;
  columns: number;
};

/** 截断文本 */
function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : text;
}

export function Commands({ commands, maxHeight, columns }: Props): React.ReactNode {
  const maxWidth = Math.max(1, columns - 10);
  const visibleCount = Math.max(1, Math.floor((maxHeight - 6) / 1));

  const sortedCommands = useMemo(
    () => [...commands].sort((a, b) => a.name.localeCompare(b.name)),
    [commands],
  );

  const shown = sortedCommands.slice(0, visibleCount);
  const remaining = sortedCommands.length - shown.length;

  return (
    <Box flexDirection="column" paddingY={1}>
      {shown.map((cmd) => (
        <Box key={cmd.name} gap={1}>
          <Box width={20}>
            <Text color="cyan">/{cmd.name}</Text>
          </Box>
          <Text dimColor>{truncate(cmd.description, maxWidth - 22)}</Text>
        </Box>
      ))}
      {remaining > 0 && (
        <Text dimColor>… 还有 {remaining} 个命令</Text>
      )}
      {commands.length === 0 && (
        <Text dimColor>无可用命令</Text>
      )}
    </Box>
  );
}
