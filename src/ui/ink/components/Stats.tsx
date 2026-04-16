/**
 * Stats — 统计面板（简化版）
 *
 * 功能：展示当前会话的 token 使用、费用和对话轮次等统计信息。
 * 简化：去掉 asciichart 图表和 heatmap，保留核心数据表格。
 */

import React, { useMemo } from 'react';
import { Box, Text } from '../primitives.js';
import { Pane } from './design-system/Pane.js';
import { useRegisterOverlay } from '../context/overlayContext.js';

export interface StatsData {
  /** 总 token 使用量 */
  totalTokens: number;
  /** 总费用（美元） */
  totalCost: number;
  /** 对话轮次 */
  turns: number;
  /** 工具调用次数 */
  toolCalls: number;
  /** 会话持续时间（秒） */
  durationSeconds: number;
  /** 当前模型 */
  model: string;
  /** 当前 provider */
  provider: string;
}

type Props = {
  data: StatsData;
  onClose: () => void;
};

/** 格式化 token 数量 */
function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/** 格式化费用 */
function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

/** 格式化持续时间 */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (mins < 60) return `${mins}m ${secs}s`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

interface StatRowProps {
  label: string;
  value: string;
  color?: string;
}

function StatRow({ label, value, color }: StatRowProps): React.ReactNode {
  return (
    <Box gap={2}>
      <Box width={20}>
        <Text dimColor>{label}</Text>
      </Box>
      <Text color={color} bold>{value}</Text>
    </Box>
  );
}

export function Stats({ data, onClose: _onClose }: Props): React.ReactNode {
  useRegisterOverlay('stats');

  const rows = useMemo(() => [
    { label: '提供商', value: data.provider },
    { label: '模型', value: data.model },
    { label: 'Token 使用量', value: formatTokens(data.totalTokens), color: 'cyan' },
    { label: '费用', value: formatCost(data.totalCost), color: 'yellow' },
    { label: '对话轮次', value: String(data.turns) },
    { label: '工具调用', value: String(data.toolCalls) },
    { label: '会话时长', value: formatDuration(data.durationSeconds) },
  ], [data]);

  return (
    <Pane color="cyan">
      <Box flexDirection="column" gap={1}>
        <Text bold color="cyan">Session Statistics</Text>
        <Box flexDirection="column">
          {rows.map((row) => (
            <StatRow
              key={row.label}
              label={row.label}
              value={row.value}
              color={row.color}
            />
          ))}
        </Box>
        <Text dimColor>按 Esc 关闭</Text>
      </Box>
    </Pane>
  );
}
