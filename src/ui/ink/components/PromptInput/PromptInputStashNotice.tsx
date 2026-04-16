/**
 * PromptInputStashNotice — Stash 提示
 *
 * 功能：当有暂存的输入时显示提示。
 */

import React from 'react';
import figures from 'figures';
import { Box, Text } from '../../primitives.js';

type Props = {
  hasStash: boolean;
};

export function PromptInputStashNotice({ hasStash }: Props): React.ReactNode {
  if (!hasStash) {
    return null;
  }

  return (
    <Box paddingLeft={2}>
      <Text dimColor>
        {figures.pointerSmall} 已暂存 (提交后自动恢复)
      </Text>
    </Box>
  );
}
