/**
 * CustomSelect — 高级选择器
 *
 * 提供单选（Select）和多选（SelectMulti）能力，支持搜索过滤和描述文本。
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from '../../primitives.js';

// ─── 类型 ───

export interface SelectOption<T extends string = string> {
  value: T;
  label: string | React.ReactNode;
  description?: string;
  disabled?: boolean;
}

// ─── Select（单选） ───

interface SelectProps<T extends string> {
  options: SelectOption<T>[];
  defaultValue?: T;
  onChange: (value: T) => void;
  onCancel?: () => void;
  visibleCount?: number;
}

export function CustomSelect<T extends string>({
  options,
  defaultValue,
  onChange,
  onCancel,
  visibleCount = 10,
}: SelectProps<T>): React.ReactNode {
  const defaultIndex = defaultValue
    ? options.findIndex((o) => o.value === defaultValue)
    : 0;
  const [focusIndex, setFocusIndex] = useState(Math.max(0, defaultIndex));

  useInput((_input, key) => {
    if (key.escape && onCancel) { onCancel(); return; }
    if (key.upArrow) {
      setFocusIndex((prev) => {
        let next = prev - 1;
        while (next >= 0 && options[next]?.disabled) next--;
        return next >= 0 ? next : prev;
      });
    }
    if (key.downArrow) {
      setFocusIndex((prev) => {
        let next = prev + 1;
        while (next < options.length && options[next]?.disabled) next++;
        return next < options.length ? next : prev;
      });
    }
    if (key.return) {
      const opt = options[focusIndex];
      if (opt && !opt.disabled) onChange(opt.value);
    }
  });

  // 滚动窗口
  const startIndex = Math.max(0, Math.min(focusIndex - Math.floor(visibleCount / 2), options.length - visibleCount));
  const visible = options.slice(startIndex, startIndex + visibleCount);

  return (
    <Box flexDirection="column">
      {visible.map((opt, i) => {
        const actualIndex = startIndex + i;
        const isFocused = actualIndex === focusIndex;
        const labelText = typeof opt.label === 'string' ? opt.label : null;
        return (
          <Text key={opt.value} color={isFocused ? 'cyan' : opt.disabled ? 'gray' : undefined} bold={isFocused}>
            {isFocused ? ' ▸ ' : '   '}
            {labelText ?? opt.label}
            {opt.description ? <Text dimColor>{' '}{opt.description}</Text> : null}
          </Text>
        );
      })}
    </Box>
  );
}

// ─── SelectMulti（多选） ───

interface SelectMultiProps<T extends string> {
  options: SelectOption<T>[];
  selected: Set<T>;
  onChange: (selected: Set<T>) => void;
  onConfirm: () => void;
  onCancel?: () => void;
  visibleCount?: number;
}

export function SelectMulti<T extends string>({
  options,
  selected,
  onChange,
  onConfirm,
  onCancel,
  visibleCount = 10,
}: SelectMultiProps<T>): React.ReactNode {
  const [focusIndex, setFocusIndex] = useState(0);

  useInput((input, key) => {
    if (key.escape && onCancel) { onCancel(); return; }
    if (key.upArrow) setFocusIndex((prev) => Math.max(0, prev - 1));
    if (key.downArrow) setFocusIndex((prev) => Math.min(options.length - 1, prev + 1));
    if (key.return) { onConfirm(); return; }
    if (input === ' ') {
      const opt = options[focusIndex];
      if (opt && !opt.disabled) {
        const next = new Set(selected);
        if (next.has(opt.value)) {
          next.delete(opt.value);
        } else {
          next.add(opt.value);
        }
        onChange(next);
      }
    }
  });

  const startIndex = Math.max(0, Math.min(focusIndex - Math.floor(visibleCount / 2), options.length - visibleCount));
  const visible = options.slice(startIndex, startIndex + visibleCount);

  return (
    <Box flexDirection="column">
      {visible.map((opt, i) => {
        const actualIndex = startIndex + i;
        const isFocused = actualIndex === focusIndex;
        const isSelected = selected.has(opt.value);
        const labelText = typeof opt.label === 'string' ? opt.label : null;
        return (
          <Text key={opt.value} color={isFocused ? 'cyan' : opt.disabled ? 'gray' : undefined} bold={isFocused}>
            <Text color={isFocused ? 'cyan' : undefined}>{isSelected ? '◉' : '○'}</Text>
            {' '}{labelText ?? opt.label}
            {opt.description ? <Text dimColor>{' '}{opt.description}</Text> : null}
          </Text>
        );
      })}
      <Text dimColor>空格 切换 · Enter 确认 · Esc 取消</Text>
    </Box>
  );
}
