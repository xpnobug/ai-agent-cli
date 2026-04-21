/**
 * UserBashOutputMessage — 用户 Bash 命令输出展示
 *
 * 以 dimColor 展示 Bash 命令的 stdout/stderr 输出，并截断过长内容。
 */

import React from 'react';
import { Box, Text } from '../../primitives.js';
import { MessageResponse } from '../MessageResponse.js';
import { getInkColors } from '../../../theme.js';

const MAX_OUTPUT_LINES = 15;

type Props = {
  /** stdout 输出 */
  stdout?: string;
  /** stderr 输出 */
  stderr?: string;
  /** 是否 verbose（显示全部输出） */
  verbose?: boolean;
};

export function UserBashOutputMessage({ stdout = '', stderr = '', verbose = false }: Props): React.ReactNode {
  const output = (stdout + (stderr ? `\n${stderr}` : '')).trim();
  const colors = getInkColors();

  if (!output) {
    return (
      <MessageResponse height={1}>
        <Text dimColor>(no output)</Text>
      </MessageResponse>
    );
  }

  const lines = output.split('\n');
  const truncated = !verbose && lines.length > MAX_OUTPUT_LINES;
  const shown = truncated ? lines.slice(0, MAX_OUTPUT_LINES).join('\n') : output;
  const extra = lines.length - MAX_OUTPUT_LINES;

  return (
    <MessageResponse>
      <Box flexDirection="column">
        <Text dimColor>{shown}</Text>
        {truncated && extra > 0 && (
          <Text dimColor>… +{extra} lines</Text>
        )}
        {stderr && !verbose && (
          <Text color={colors.error} dimColor>{stderr.slice(0, 200)}</Text>
        )}
      </Box>
    </MessageResponse>
  );
}
