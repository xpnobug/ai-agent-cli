/**
 * HistorySearchInput — 内联历史搜索输入
 *
 * 功能：在 footer 区域显示 "search prompts:" + 内联搜索框（Ctrl+R 触发）
 */

import React from 'react';
import { Box, Text } from '../../primitives.js';
import TextInput from '../TextInput.js';

type Props = {
  value: string;
  onChange: (value: string) => void;
  historyFailedMatch: boolean;
};

export function HistorySearchInput({
  value,
  onChange,
  historyFailedMatch,
}: Props): React.ReactNode {
  const label = historyFailedMatch ? '未匹配:' : '搜索历史:';

  return (
    <Box gap={1}>
      <Text dimColor>{label}</Text>
      <TextInput
        value={value}
        onChange={onChange}
        cursorOffset={value.length}
        onChangeCursorOffset={() => {}}
        columns={Math.max(10, value.length + 1)}
        focus
        multiline={false}
      />
    </Box>
  );
}
