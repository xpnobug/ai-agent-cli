/**
 * AssistantThinkingMessage — 助手思考过程展示
 *
 * - 非 verbose/transcript 模式：显示 "∴ Thinking"（折叠）
 * - verbose/transcript 模式：显示 HighlightedThinkingText（关键词高亮）
 * - hideInTranscript 时不渲染
 */

import React from 'react';
import { Box, Text } from '../../primitives.js';
import { CtrlOToExpand } from '../CtrlOToExpand.js';
import { HighlightedThinkingText } from './HighlightedThinkingText.js';

type Props = {
  /** 思考块内容 */
  thinking: string;
  /** 是否添加顶部间距 */
  addMargin?: boolean;
  /** 是否为 transcript 模式 */
  isTranscriptMode?: boolean;
  /** 是否 verbose */
  verbose?: boolean;
  /** 在 transcript 模式中隐藏此思考块 */
  hideInTranscript?: boolean;
};

export function AssistantThinkingMessage({
  thinking,
  addMargin = false,
  isTranscriptMode = false,
  verbose = false,
  hideInTranscript = false,
}: Props): React.ReactNode {
  if (!thinking || hideInTranscript) {
    return null;
  }

  const shouldShowFullThinking = isTranscriptMode || verbose;

  // 折叠模式：只显示 "∴ Thinking"
  if (!shouldShowFullThinking) {
    return (
      <Box marginTop={addMargin ? 1 : 0}>
        <Text dimColor italic>∴ Thinking </Text>
        <CtrlOToExpand />
      </Box>
    );
  }

  // 展开模式：使用 HighlightedThinkingText 渲染关键词高亮
  return (
    <Box flexDirection="column" gap={1} marginTop={addMargin ? 1 : 0} width="100%">
      <Text dimColor italic>∴ Thinking…</Text>
      <Box paddingLeft={2}>
        <HighlightedThinkingText text={thinking} />
      </Box>
    </Box>
  );
}
