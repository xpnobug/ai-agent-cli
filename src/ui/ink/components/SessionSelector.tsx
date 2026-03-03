/**
 * 会话选择器
 */

import { Box, Text, useInput, useStdout } from 'ink';
import { useEffect, useMemo, useState } from 'react';
import type { SessionListItem } from '../../../services/session/sessionResume.js';
import { formatDate } from '../../../utils/dateFormat.js';
import { getInkColors } from '../../theme.js';

export interface SessionSelectorProps {
  sessions: SessionListItem[];
  onSelect: (index: number) => void;
  onCancel?: () => void;
}

export function SessionSelector({ sessions, onSelect, onCancel }: SessionSelectorProps) {
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
  const total = sessions.length;
  const visibleCount = Math.max(3, (size.rows || 24) - 3);
  const hiddenCount = Math.max(0, total - visibleCount);

  const windowStart = useMemo(() => {
    if (total <= visibleCount) return 0;
    const half = Math.floor(visibleCount / 2);
    const min = Math.max(0, index - half);
    const max = Math.max(0, total - visibleCount);
    return Math.min(min, max);
  }, [index, total, visibleCount]);

  const visibleSessions = sessions.slice(windowStart, windowStart + visibleCount);

  useInput((input, key) => {
    if (key.downArrow || input === 'j') {
      setIndex((prev) => Math.min(total - 1, prev + 1));
      return;
    }
    if (key.upArrow || input === 'k') {
      setIndex((prev) => Math.max(0, prev - 1));
      return;
    }
    if (key.return) {
      onSelect(index);
    }
    if (key.escape) {
      onCancel?.();
    }
  });

  if (total === 0) return null;

  const indexWidth = 7;
  const modifiedWidth = 21;
  const createdWidth = 21;
  const tagWidth = 10;

  return (
    <Box flexDirection="column" height="100%" width="100%">
      <Box paddingLeft={9}>
        <Text bold color={colors.heading}>Modified</Text>
        <Text>{'             '}</Text>
        <Text bold color={colors.heading}>Created</Text>
        <Text>{'             '}</Text>
        <Text bold color={colors.heading}>Tag</Text>
        <Text>{'      '}</Text>
        <Text bold color={colors.heading}>Session</Text>
      </Box>

      <Box flexDirection="column">
        {visibleSessions.map((s, i) => {
          const realIndex = windowStart + i;
          const isSelected = realIndex === index;
          const modified = formatDate(s.modifiedAt ?? s.createdAt ?? new Date(0)).padEnd(modifiedWidth);
          const created = formatDate(s.createdAt ?? s.modifiedAt ?? new Date(0)).padEnd(createdWidth);
          const tag = (s.tag ? `#${s.tag}` : '').padEnd(tagWidth);
          const name = s.customTitle ?? s.slug ?? s.sessionId;
          const summary = s.summary ? s.summary.split('\n')[0] : '';
          const indexLabel = `[${realIndex}]`.padEnd(indexWidth);

          const labelText = `${indexLabel}${modified}${created}${tag}${name}${summary ? ` — ${summary}` : ''}`;
          const truncated =
            labelText.length > (size.columns || 80) - 2
              ? `${labelText.slice(0, (size.columns || 80) - 5)}...`
              : labelText;

          return (
            <Text key={s.sessionId} color={isSelected ? colors.primary : undefined}>
              {isSelected ? '❯ ' : '  '}
              {truncated}
            </Text>
          );
        })}
      </Box>

      {hiddenCount > 0 && (
        <Box paddingLeft={2}>
          <Text color={colors.textDim}>and {hiddenCount} more…</Text>
        </Box>
      )}
    </Box>
  );
}
