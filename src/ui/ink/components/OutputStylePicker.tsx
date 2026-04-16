/**
 * OutputStylePicker — 输出风格选择器
 *
 * 功能：/output-style 命令触发，选择 AI 输出风格。
 */

import React, { useState } from 'react';
import { Box, Text } from '../primitives.js';
import { FuzzyPicker } from './design-system/FuzzyPicker.js';
import { useRegisterOverlay } from '../context/overlayContext.js';

export type OutputStyle = 'concise' | 'normal' | 'explanatory' | 'learning';

type Props = {
  currentStyle: OutputStyle;
  onSelect: (style: OutputStyle) => void;
  onCancel: () => void;
};

type StyleItem = {
  id: OutputStyle;
  name: string;
  description: string;
};

const STYLES: StyleItem[] = [
  { id: 'concise', name: '简洁', description: '最少文字，直接给出结果' },
  { id: 'normal', name: '标准', description: '平衡的输出风格' },
  { id: 'explanatory', name: '详细', description: '解释推理过程和决策' },
  { id: 'learning', name: '教学', description: '教学风格，解释原理' },
];

export function OutputStylePicker({ currentStyle, onSelect, onCancel }: Props): React.ReactNode {
  useRegisterOverlay('output-style-picker');
  const [query, setQuery] = useState('');

  const filtered = query
    ? STYLES.filter((s) => s.name.includes(query) || s.description.includes(query))
    : STYLES;

  return (
    <FuzzyPicker
      title="选择输出风格"
      placeholder="搜索风格…"
      items={filtered}
      getKey={(item) => item.id}
      onQueryChange={setQuery}
      onSelect={(item) => onSelect(item.id)}
      onCancel={onCancel}
      emptyMessage="未找到匹配风格"
      selectAction="应用"
      renderItem={(item, isFocused) => (
        <Box gap={2}>
          <Text color={isFocused ? 'cyan' : undefined} bold={item.id === currentStyle}>
            {item.id === currentStyle ? '● ' : '  '}{item.name}
          </Text>
          <Text dimColor>{item.description}</Text>
        </Box>
      )}
    />
  );
}
