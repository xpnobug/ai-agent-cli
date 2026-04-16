/**
 * ThemePicker — 主题选择器
 *
 * 功能：通过 FuzzyPicker 列出可用终端主题，实时预览并选择。
 */

import React, { useMemo, useState } from 'react';
import { Box, Text } from '../primitives.js';
import { FuzzyPicker } from './design-system/FuzzyPicker.js';
import { useRegisterOverlay } from '../context/overlayContext.js';

type Props = {
  /** 当前主题名 */
  currentTheme: string;
  /** 可用主题列表 */
  themes: ThemeOption[];
  /** 选择主题后的回调 */
  onSelect: (themeId: string) => void;
  /** 取消 */
  onCancel: () => void;
};

export type ThemeOption = {
  id: string;
  name: string;
  description?: string;
  /** 预览色彩样本 */
  colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
  };
};

type ThemeItem = ThemeOption & { lower: string };

export function ThemePicker({
  currentTheme,
  themes,
  onSelect,
  onCancel,
}: Props): React.ReactNode {
  useRegisterOverlay('theme-picker');
  const [query, setQuery] = useState('');

  const allItems = useMemo((): ThemeItem[] => {
    return themes.map((t) => ({
      ...t,
      lower: `${t.name} ${t.description ?? ''}`.toLowerCase(),
    }));
  }, [themes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter((item) => item.lower.includes(q));
  }, [allItems, query]);

  return (
    <FuzzyPicker
      title="选择主题"
      placeholder="输入主题名称搜索…"
      items={filtered}
      getKey={(item) => item.id}
      onQueryChange={setQuery}
      onSelect={(item) => onSelect(item.id)}
      onCancel={onCancel}
      emptyMessage="未找到匹配主题"
      selectAction="应用"
      renderItem={(item, isFocused) => (
        <Box gap={2}>
          <Text color={isFocused ? 'cyan' : undefined} bold={item.id === currentTheme}>
            {item.id === currentTheme ? '● ' : '  '}
            {item.name}
          </Text>
          {item.description && (
            <Text dimColor>{item.description}</Text>
          )}
        </Box>
      )}
    />
  );
}
