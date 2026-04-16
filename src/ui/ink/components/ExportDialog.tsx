/**
 * ExportDialog — 导出对话框
 *
 * 功能：/export 命令触发，选择导出格式并导出对话记录。
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from '../primitives.js';
import { Pane } from './design-system/Pane.js';

export type ExportFormat = 'json' | 'markdown' | 'text';

type Props = {
  onExport: (format: ExportFormat) => void;
  onCancel: () => void;
};

const FORMATS: { value: ExportFormat; label: string; description: string }[] = [
  { value: 'json', label: 'JSON', description: '完整结构化数据' },
  { value: 'markdown', label: 'Markdown', description: '人类可读格式' },
  { value: 'text', label: '纯文本', description: '无格式纯文本' },
];

export function ExportDialog({ onExport, onCancel }: Props): React.ReactNode {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((_input, key) => {
    if (key.escape) { onCancel(); return; }
    if (key.upArrow) setSelectedIndex((prev) => Math.max(0, prev - 1));
    if (key.downArrow) setSelectedIndex((prev) => Math.min(FORMATS.length - 1, prev + 1));
    if (key.return) onExport(FORMATS[selectedIndex]!.value);
  });

  return (
    <Pane color="cyan">
      <Box flexDirection="column" gap={1}>
        <Text bold color="cyan">导出对话</Text>
        {FORMATS.map((fmt, i) => (
          <Box key={fmt.value} gap={1}>
            <Text color={i === selectedIndex ? 'cyan' : undefined} bold={i === selectedIndex}>
              {i === selectedIndex ? '▸ ' : '  '}{fmt.label}
            </Text>
            <Text dimColor>{fmt.description}</Text>
          </Box>
        ))}
        <Text dimColor>↑↓ 选择 · Enter 导出 · Esc 取消</Text>
      </Box>
    </Pane>
  );
}
