/**
 * HelpV2 — 完整帮助面板
 *
 * - Pane 容器 color=professionalBlue（用 suggestion 代替）
 * - Tabs 标题 = 产品名+版本
 * - 3 个 Tab: general / commands / custom-commands
 * - 底部 esc to cancel
 */

import React, { useMemo } from 'react';
import { Box, Text, useInput } from '../../primitives.js';
import { Pane } from '../design-system/Pane.js';
import { Tab, Tabs } from '../design-system/Tabs.js';
import { General } from './General.js';
import { Commands } from './Commands.js';
import { useTerminalSize } from '../../hooks/useTerminalSize.js';
import { PRODUCT_NAME, VERSION } from '../../../../core/constants.js';

type Props = {
  onClose: () => void;
  commands: { name: string; description: string; isHidden?: boolean }[];
};

export function HelpV2({ onClose, commands }: Props): React.ReactNode {
  const { rows, columns } = useTerminalSize();
  const maxHeight = Math.floor(rows / 2);

  const visibleCommands = useMemo(
    () => commands.filter((cmd) => !cmd.isHidden),
    [commands],
  );

  useInput((_input, key) => {
    if (key.escape) onClose();
  });

  return (
    <Pane color="cyan">
      <Tabs title={`${PRODUCT_NAME} v${VERSION}`}>
        <Tab id="general" title="general">
          <General />
        </Tab>
        <Tab id="commands" title="commands">
          <Commands
            commands={visibleCommands}
            maxHeight={maxHeight}
            columns={columns}
          />
        </Tab>
      </Tabs>
      <Box marginTop={1}>
        <Text dimColor italic>esc to cancel</Text>
      </Box>
    </Pane>
  );
}
