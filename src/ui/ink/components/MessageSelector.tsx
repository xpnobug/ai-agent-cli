/**
 * MessageSelector — 消息选择器
 *
 * 功能：双击 Esc 触发，允许用户选择历史消息进行回溯编辑。
 */

import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from '../primitives.js';
import type { CompletedItem } from '../types.js';

type Props = {
  items: CompletedItem[];
  onSelect: (index: number) => void;
  onCancel: () => void;
};

/** 提取消息摘要 */
function getItemSummary(item: CompletedItem): string | null {
  switch (item.type) {
    case 'user_message':
      return item.text?.slice(0, 80) ?? null;
    case 'ai_message':
      return item.text?.slice(0, 80) ?? null;
    default:
      return null;
  }
}

export function MessageSelector({ items, onSelect, onCancel }: Props): React.ReactNode {
  const selectableItems = useMemo(() => {
    return items
      .map((item, index) => ({ item, index, summary: getItemSummary(item) }))
      .filter((entry) => entry.summary !== null)
      .reverse()
      .slice(0, 20);
  }, [items]);

  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((_input, key) => {
    if (key.escape) { onCancel(); return; }
    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    }
    if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(selectableItems.length - 1, prev + 1));
    }
    if (key.return && selectableItems[selectedIndex]) {
      onSelect(selectableItems[selectedIndex].index);
    }
  });

  if (selectableItems.length === 0) {
    return <Text dimColor>无可选消息</Text>;
  }

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
      <Text bold color="cyan">选择消息</Text>
      {selectableItems.map((entry, i) => (
        <Box key={entry.index}>
          <Text color={i === selectedIndex ? 'cyan' : undefined} bold={i === selectedIndex}>
            {i === selectedIndex ? '▸ ' : '  '}
            <Text dimColor={entry.item.type !== 'user_message'}>
              {entry.item.type === 'user_message' ? '你: ' : 'AI: '}
            </Text>
            {entry.summary}
          </Text>
        </Box>
      ))}
      <Text dimColor>↑↓ 导航 · Enter 选择 · Esc 取消</Text>
    </Box>
  );
}
