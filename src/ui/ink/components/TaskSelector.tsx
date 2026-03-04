/**
 * 任务选择器（/tasks）
 */

import { Box, Text, useInput, useStdout } from 'ink';
import { useEffect, useMemo, useState } from 'react';
import type { TaskListItem } from '../../../services/session/taskList.js';
import { getInkColors } from '../../theme.js';

export interface TaskSelectorProps {
  tasks: TaskListItem[];
  onAction: (action: 'output' | 'stop', taskId: string) => void;
  onCancel?: () => void;
}

function formatElapsed(task: TaskListItem): string {
  const end = task.completedAt ?? Date.now();
  return `${((end - task.startedAt) / 1000).toFixed(1)}s`;
}

export function TaskSelector({ tasks, onAction, onCancel }: TaskSelectorProps) {
  const colors = getInkColors();
  const { stdout } = useStdout();
  const [size, setSize] = useState(() => ({
    rows: stdout?.rows ?? 24,
    columns: stdout?.columns ?? 80,
  }));

  useEffect(() => {
    if (!stdout) return;
    const update = () => {
      setSize({
        rows: stdout.rows ?? 24,
        columns: stdout.columns ?? 80,
      });
    };
    update();
    stdout.on('resize', update);
    return () => {
      stdout.off('resize', update);
    };
  }, [stdout]);

  const [index, setIndex] = useState(0);
  const total = tasks.length;
  const visibleCount = Math.max(3, (size.rows || 24) - 5);
  const hiddenCount = Math.max(0, total - visibleCount);

  useEffect(() => {
    if (index >= total) {
      setIndex(Math.max(0, total - 1));
    }
  }, [index, total]);

  const windowStart = useMemo(() => {
    if (total <= visibleCount) return 0;
    const half = Math.floor(visibleCount / 2);
    const min = Math.max(0, index - half);
    const max = Math.max(0, total - visibleCount);
    return Math.min(min, max);
  }, [index, total, visibleCount]);

  const visibleTasks = tasks.slice(windowStart, windowStart + visibleCount);

  useInput((input, key) => {
    if (key.downArrow || input === 'j') {
      setIndex((prev) => Math.min(total - 1, prev + 1));
      return;
    }
    if (key.upArrow || input === 'k') {
      setIndex((prev) => Math.max(0, prev - 1));
      return;
    }
    if (key.return || input === 'o') {
      const selected = tasks[index];
      if (selected) {
        onAction('output', selected.id);
      }
      return;
    }
    if (input === 'x' || input === 'd') {
      const selected = tasks[index];
      if (selected) {
        onAction('stop', selected.id);
      }
      return;
    }
    if (key.escape) {
      onCancel?.();
    }
  });

  if (total === 0) return null;

  const idWidth = 12;
  const typeWidth = 8;
  const statusWidth = 12;
  const elapsedWidth = 8;

  return (
    <Box flexDirection="column" height="100%" width="100%">
      <Box paddingLeft={2}>
        <Text bold color={colors.heading}>ID</Text>
        <Text>{' '.repeat(Math.max(1, idWidth - 2))}</Text>
        <Text bold color={colors.heading}>Type</Text>
        <Text>{' '.repeat(Math.max(1, typeWidth - 4))}</Text>
        <Text bold color={colors.heading}>Status</Text>
        <Text>{' '.repeat(Math.max(1, statusWidth - 6))}</Text>
        <Text bold color={colors.heading}>Elapsed</Text>
        <Text>{' '.repeat(Math.max(1, elapsedWidth - 7))}</Text>
        <Text bold color={colors.heading}>Description</Text>
      </Box>

      <Box flexDirection="column">
        {visibleTasks.map((task, i) => {
          const realIndex = windowStart + i;
          const isSelected = realIndex === index;
          const typeLabel = task.taskType === 'bash' ? 'Bash' : 'Agent';
          const retrieved = task.taskType === 'agent' && task.retrieved ? ' (已读)' : '';
          const line = [
            task.id.padEnd(idWidth),
            typeLabel.padEnd(typeWidth),
            `${task.status}${retrieved}`.padEnd(statusWidth),
            formatElapsed(task).padEnd(elapsedWidth),
            task.description,
          ].join('');
          const truncated =
            line.length > (size.columns || 80) - 2
              ? `${line.slice(0, (size.columns || 80) - 5)}...`
              : line;
          return (
            <Text key={`${task.id}-${realIndex}`} color={isSelected ? colors.primary : undefined}>
              {isSelected ? '❯ ' : '  '}
              {truncated}
            </Text>
          );
        })}
      </Box>

      <Box paddingLeft={2}>
        <Text color={colors.textDim}>Enter 查看输出 · x 停止任务 · Esc 取消</Text>
        {hiddenCount > 0 && (
          <Text color={colors.textDim}>{` · 还有 ${hiddenCount} 条`}</Text>
        )}
      </Box>
    </Box>
  );
}
