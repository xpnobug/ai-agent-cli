/**
 * EnhancedSpinner - 增强版 Spinner 组件
 *
 * Claude Code 风格动态状态展示（呼吸灯效果）：
 * ✱ Thinking… (44s · ↓ 522 tokens · thinking)
 * · Whirring… (1m 14s · ↓ 870 tokens · bash)
 *
 * token 计数通过 getTokenStats 回调实时获取，每次动画帧刷新。
 */

import { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import type { LoadingState } from '../types.js';
import { isAccessibilityMode, getInkColors } from '../../theme.js';
import { useElapsedTime } from '../hooks.js';

/** 实时 token 统计的最小接口 */
export interface TokenStatsSnapshot {
  totalTokens: number;
  totalCost: number;
}

export interface EnhancedSpinnerProps {
  loading: NonNullable<LoadingState>;
  getTokenStats?: () => TokenStatsSnapshot;
}

/** 格式化耗时：44s / 1m 14s */
function formatElapsed(seconds: number): string {
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
  }
  return `${Math.round(seconds)}s`;
}

/** 格式化 token 数：870 / 1.2k */
function formatTokens(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return String(count);
}

/** 获取标签和模式描述 */
function getModeInfo(loading: NonNullable<LoadingState>): { label: string; mode: string } {
  switch (loading.mode) {
    case 'thinking':
      return { label: 'Thinking…', mode: 'thinking' };
    case 'tool_use':
      return {
        label: 'Whirring…',
        mode: loading.toolName || 'tool',
      };
    case 'requesting':
      return { label: 'Starting…', mode: 'requesting' };
  }
}

/**
 * 呼吸灯动画帧定义
 *
 * 6 帧 × 300ms = 1.8s 一个完整周期
 * 视觉节奏：亮→亮→渐暗→暗→暗→渐亮（类正弦波）
 */
const BREATHING_FRAMES: Array<{ char: string; bright: boolean }> = [
  { char: '✱', bright: true },   // 峰值
  { char: '✱', bright: true },   // 保持
  { char: '✱', bright: false },  // 渐暗
  { char: '·', bright: false },  // 谷值
  { char: '·', bright: false },  // 保持
  { char: '✱', bright: false },  // 渐亮
];

export function EnhancedSpinner({ loading, getTokenStats }: EnhancedSpinnerProps) {
  const elapsed = useElapsedTime(loading.startTime);
  const { label, mode } = getModeInfo(loading);

  // 呼吸灯动画计时器（300ms 帧率）
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setTick(prev => prev + 1);
    }, 300);
    return () => clearInterval(timer);
  }, []);

  // 无障碍模式：纯文本
  if (isAccessibilityMode()) {
    return <Text>[处理中] {label} ({formatElapsed(elapsed)})</Text>;
  }

  const colors = getInkColors();
  const frame = BREATHING_FRAMES[tick % BREATHING_FRAMES.length]!;

  // 实时 token：优先从回调获取最新值，回退到 loading 快照
  const liveStats = getTokenStats?.();
  const tokenCount = liveStats?.totalTokens || loading.tokenCount;

  // 构建括号内动态信息：(44s · ↓ 522 tokens · thinking)
  const parts: string[] = [];
  parts.push(formatElapsed(elapsed));
  if (tokenCount) {
    parts.push(`↓ ${formatTokens(tokenCount)} tokens`);
  }
  parts.push(mode);
  const stats = parts.join(' · ');

  return (
    <Box marginTop={1}>
      <Text color={frame.bright ? colors.primary : undefined} dimColor={!frame.bright}>
        {frame.char}
      </Text>
      <Text> </Text>
      <Text dimColor>{label} ({stats})</Text>
    </Box>
  );
}
