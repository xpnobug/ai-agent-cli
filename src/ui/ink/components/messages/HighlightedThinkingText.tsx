/**
 * HighlightedThinkingText — Thinking 文本增强渲染
 *
 * 功能：thinking 文本支持关键词高亮、彩虹色、时间戳。
 */

import React, { useMemo } from 'react';
import figures from 'figures';
import { Box, Text } from '../../primitives.js';

type Props = {
  text: string;
  timestamp?: string;
};

/** 彩虹色序列 */
const RAINBOW_COLORS = ['red', 'yellow', 'green', 'cyan', 'blue', 'magenta'] as const;

/** 关键词高亮（think 触发词等） */
const HIGHLIGHT_KEYWORDS = new Set([
  'think', 'thinking', 'thought', 'consider', 'analyze', 'plan',
  'approach', 'strategy', 'step', 'first', 'next', 'finally',
]);

function getRainbowColor(index: number): string {
  return RAINBOW_COLORS[index % RAINBOW_COLORS.length]!;
}

/** 将文本按关键词分段，高亮匹配部分 */
function highlightKeywords(text: string): React.ReactNode[] {
  const words = text.split(/(\s+)/);
  let colorIndex = 0;

  return words.map((word, i) => {
    const lower = word.toLowerCase().replace(/[^a-z]/g, '');
    if (HIGHLIGHT_KEYWORDS.has(lower)) {
      const color = getRainbowColor(colorIndex++);
      return <Text key={i} color={color} bold>{word}</Text>;
    }
    return <Text key={i} dimColor>{word}</Text>;
  });
}

export function HighlightedThinkingText({ text, timestamp }: Props): React.ReactNode {
  const highlighted = useMemo(() => highlightKeywords(text), [text]);

  return (
    <Box flexDirection="column">
      {timestamp && (
        <Text dimColor>{timestamp}</Text>
      )}
      <Box flexDirection="row" flexWrap="wrap">
        <Text dimColor>{figures.pointerSmall} </Text>
        {highlighted}
      </Box>
    </Box>
  );
}
