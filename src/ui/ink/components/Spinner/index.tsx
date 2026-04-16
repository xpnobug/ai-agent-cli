/**
 * Spinner/ — 增强 Spinner 动画系统
 *
 * 功能：闪烁字符 + 微光动画 + 停顿检测，替代简单的 dots spinner。
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text } from '../../primitives.js';

// ─── 类型 ───

export interface SpinnerGlyphConfig {
  frames: string[];
  interval: number;
}

// ─── 预定义动画 ───

const DOTS: SpinnerGlyphConfig = {
  frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  interval: 80,
};

const THINKING: SpinnerGlyphConfig = {
  frames: ['◐', '◓', '◑', '◒'],
  interval: 200,
};

const PULSE: SpinnerGlyphConfig = {
  frames: ['●', '◉', '○', '◉'],
  interval: 300,
};

export const SPINNER_PRESETS = { dots: DOTS, thinking: THINKING, pulse: PULSE } as const;

// ─── useSpinnerAnimation Hook ───

export function useSpinnerAnimation(config: SpinnerGlyphConfig): string {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((prev) => (prev + 1) % config.frames.length);
    }, config.interval);
    return () => clearInterval(timer);
  }, [config.frames.length, config.interval]);

  return config.frames[frame] ?? config.frames[0]!;
}

// ─── FlashingChar — 闪烁字符 ───

export function FlashingChar({
  children,
  intervalMs = 500,
}: {
  children: string;
  intervalMs?: number;
}): React.ReactNode {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => setVisible((v) => !v), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return <Text dimColor={!visible}>{children}</Text>;
}

// ─── ShimmerChar — 微光字符 ───

const SHIMMER_CHARS = '░▒▓█▓▒░';

export function ShimmerChar({
  width = 8,
  intervalMs = 100,
}: {
  width?: number;
  intervalMs?: number;
}): React.ReactNode {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setOffset((o) => (o + 1) % SHIMMER_CHARS.length), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  const chars = useMemo(() => {
    let result = '';
    for (let i = 0; i < width; i++) {
      result += SHIMMER_CHARS[(offset + i) % SHIMMER_CHARS.length];
    }
    return result;
  }, [offset, width]);

  return <Text dimColor>{chars}</Text>;
}

// ─── SpinnerGlyph — 动画字符 ───

export function SpinnerGlyph({
  preset = 'dots',
  color,
}: {
  preset?: keyof typeof SPINNER_PRESETS;
  color?: string;
}): React.ReactNode {
  const config = SPINNER_PRESETS[preset];
  const char = useSpinnerAnimation(config);
  return <Text color={color}>{char}</Text>;
}

// ─── SpinnerAnimationRow — 带标签的 Spinner 行 ───

export function SpinnerAnimationRow({
  label,
  preset = 'dots',
  color = 'cyan',
}: {
  label: string;
  preset?: keyof typeof SPINNER_PRESETS;
  color?: string;
}): React.ReactNode {
  return (
    <Box gap={1}>
      <SpinnerGlyph preset={preset} color={color} />
      <Text>{label}</Text>
    </Box>
  );
}

// ─── useStalledAnimation — 停顿检测 ───

export function useStalledAnimation(
  isLoading: boolean,
  stallThresholdMs: number = 5000,
): boolean {
  const [isStalled, setIsStalled] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setIsStalled(false);
      return;
    }

    const timer = setTimeout(() => setIsStalled(true), stallThresholdMs);
    return () => clearTimeout(timer);
  }, [isLoading, stallThresholdMs]);

  return isStalled;
}
