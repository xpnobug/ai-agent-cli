/**
 * LogSelector — 日志级别选择器
 *
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from '../primitives.js';
import { Pane } from './design-system/Pane.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

type Props = {
  currentLevel: LogLevel;
  onSelect: (level: LogLevel) => void;
  onCancel: () => void;
};

const LEVELS: { value: LogLevel; label: string; color: string }[] = [
  { value: 'debug', label: 'Debug', color: 'gray' },
  { value: 'info', label: 'Info', color: 'cyan' },
  { value: 'warn', label: 'Warn', color: 'yellow' },
  { value: 'error', label: 'Error', color: 'red' },
  { value: 'silent', label: 'Silent', color: 'gray' },
];

export function LogSelector({ currentLevel, onSelect, onCancel }: Props): React.ReactNode {
  const [selectedIndex, setSelectedIndex] = useState(
    LEVELS.findIndex((l) => l.value === currentLevel),
  );

  useInput((_input, key) => {
    if (key.escape) { onCancel(); return; }
    if (key.upArrow) setSelectedIndex((prev) => Math.max(0, prev - 1));
    if (key.downArrow) setSelectedIndex((prev) => Math.min(LEVELS.length - 1, prev + 1));
    if (key.return) onSelect(LEVELS[selectedIndex]!.value);
  });

  return (
    <Pane color="cyan">
      <Box flexDirection="column" gap={1}>
        <Text bold color="cyan">日志级别</Text>
        {LEVELS.map((level, i) => (
          <Box key={level.value} gap={1}>
            <Text color={i === selectedIndex ? 'cyan' : undefined} bold={i === selectedIndex}>
              {i === selectedIndex ? '▸ ' : '  '}
            </Text>
            <Text color={level.color} bold={level.value === currentLevel}>
              {level.label}
            </Text>
            {level.value === currentLevel && <Text dimColor>(当前)</Text>}
          </Box>
        ))}
        <Text dimColor>↑↓ 选择 · Enter 应用 · Esc 取消</Text>
      </Box>
    </Pane>
  );
}
