/**
 * LanguagePicker — 语言选择器
 *
 */

import React, { useState } from 'react';
import { Box, Text } from '../primitives.js';
import { FuzzyPicker } from './design-system/FuzzyPicker.js';
import { useRegisterOverlay } from '../context/overlayContext.js';

type Props = {
  currentLanguage: string;
  onSelect: (lang: string) => void;
  onCancel: () => void;
};

type LangItem = { id: string; name: string };

const LANGUAGES: LangItem[] = [
  { id: 'zh', name: '简体中文' },
  { id: 'en', name: 'English' },
  { id: 'ja', name: '日本語' },
  { id: 'ko', name: '한국어' },
  { id: 'es', name: 'Español' },
  { id: 'fr', name: 'Français' },
  { id: 'de', name: 'Deutsch' },
];

export function LanguagePicker({ currentLanguage, onSelect, onCancel }: Props): React.ReactNode {
  useRegisterOverlay('language-picker');
  const [query, setQuery] = useState('');

  const filtered = query
    ? LANGUAGES.filter((l) => l.name.toLowerCase().includes(query.toLowerCase()) || l.id.includes(query))
    : LANGUAGES;

  return (
    <FuzzyPicker
      title="选择语言"
      placeholder="搜索语言…"
      items={filtered}
      getKey={(item) => item.id}
      onQueryChange={setQuery}
      onSelect={(item) => onSelect(item.id)}
      onCancel={onCancel}
      emptyMessage="未找到匹配语言"
      selectAction="应用"
      renderItem={(item, isFocused) => (
        <Box gap={2}>
          <Text color={isFocused ? 'cyan' : undefined} bold={item.id === currentLanguage}>
            {item.id === currentLanguage ? '● ' : '  '}{item.name}
          </Text>
          <Text dimColor>{item.id}</Text>
        </Box>
      )}
    />
  );
}
