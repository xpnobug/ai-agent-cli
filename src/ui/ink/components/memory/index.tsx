/**
 * memory/ — 记忆组件
 *
 * MemoryFileSelector — 记忆文件选择器
 * MemoryUpdateNotification — 记忆更新通知
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from '../../primitives.js';
import figures from 'figures';

// ─── MemoryFileSelector ───

export interface MemoryFile {
  path: string;
  name: string;
  size: number;
  lastModified?: string;
}

interface MemoryFileSelectorProps {
  files: MemoryFile[];
  onSelect: (file: MemoryFile) => void;
  onCancel: () => void;
}

export function MemoryFileSelector({
  files,
  onSelect,
  onCancel,
}: MemoryFileSelectorProps): React.ReactNode {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((_input, key) => {
    if (key.escape) { onCancel(); return; }
    if (key.upArrow) setSelectedIndex((prev) => Math.max(0, prev - 1));
    if (key.downArrow) setSelectedIndex((prev) => Math.min(files.length - 1, prev + 1));
    if (key.return && files[selectedIndex]) onSelect(files[selectedIndex]);
  });

  if (files.length === 0) {
    return <Text dimColor>无记忆文件</Text>;
  }

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">记忆文件</Text>
      {files.map((file, i) => (
        <Box key={file.path} gap={1}>
          <Text color={i === selectedIndex ? 'cyan' : undefined} bold={i === selectedIndex}>
            {i === selectedIndex ? '▸ ' : '  '}{file.name}
          </Text>
          <Text dimColor>{formatBytes(file.size)}</Text>
          {file.lastModified && <Text dimColor>{file.lastModified}</Text>}
        </Box>
      ))}
      <Text dimColor>↑↓ 导航 · Enter 选择 · Esc 取消</Text>
    </Box>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// ─── MemoryUpdateNotification ───

interface MemoryUpdateNotificationProps {
  filePath: string;
  action: 'created' | 'updated' | 'deleted';
}

export function MemoryUpdateNotification({
  filePath,
  action,
}: MemoryUpdateNotificationProps): React.ReactNode {
  const actionText = action === 'created' ? '已创建' : action === 'updated' ? '已更新' : '已删除';
  const icon = action === 'deleted' ? figures.cross : figures.tick;
  const color = action === 'deleted' ? 'red' : 'green';

  return (
    <Box gap={1}>
      <Text color={color}>{icon}</Text>
      <Text dimColor>记忆文件 {actionText}: {filePath}</Text>
    </Box>
  );
}
