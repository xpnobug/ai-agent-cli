/**
 * HelpV2/General — 概览面板
 *
 * 一句介绍 + Shortcuts 标题 + PromptInputHelpMenu 紧凑格式
 */

import React from 'react';
import { Box, Text } from '../../primitives.js';
import { PromptInputHelpMenu } from '../PromptInputHelpMenu.js';

export function General(): React.ReactNode {
  return (
    <Box flexDirection="column" paddingY={1} gap={1}>
      <Text>
        AI Agent CLI 理解你的代码库，在你授权后编辑文件并执行命令 — 就在终端中。
      </Text>
      <Box flexDirection="column">
        <Text bold>Shortcuts</Text>
        <PromptInputHelpMenu gap={2} fixedWidth dimColor />
      </Box>
    </Box>
  );
}
