/**
 * CompletedItemView - Static 区域项路由组件
 * 根据 item.type 分发到对应子组件
 *
 * 布局规则（Claude Code 风格）：
 * - 每个块之间有 1 行空白间隔（marginTop={1}）
 * - AI/用户消息使用两列布局：固定宽度前缀 + 自动换行文本
 */

import { Box, Text } from 'ink';
import type { CompletedItem } from '../types.js';
import { BannerView } from './BannerView.js';
import { SystemMessage } from './SystemMessage.js';
import { ToolUseView } from './ToolUseView.js';
import { ToolResultView } from './ToolResultView.js';
import { applyMarkdown } from '../../markdown.js';
import { getInkColors } from '../../theme.js';
import { UI_SYMBOLS } from '../../../core/constants.js';

export interface CompletedItemViewProps {
  item: CompletedItem;
}

export function CompletedItemView({ item }: CompletedItemViewProps) {
  const colors = getInkColors();

  switch (item.type) {
    case 'banner':
      return <BannerView config={item.config} />;

    case 'user_message':
      return (
        <Box marginTop={1}>
          <Box flexShrink={0} width={2}>
            <Text color={colors.cursor} bold>{UI_SYMBOLS.userPrefix}</Text>
          </Box>
          <Text bold>{item.text}</Text>
        </Box>
      );

    case 'ai_message': {
      const rendered = applyMarkdown(item.text);
      return (
        <Box marginTop={1}>
          <Box flexShrink={0} width={2}>
            <Text color={colors.secondary}>{UI_SYMBOLS.aiPrefix}</Text>
          </Box>
          <Box flexGrow={1} flexShrink={1}>
            <Text>{rendered}</Text>
          </Box>
        </Box>
      );
    }

    case 'tool_use':
      return (
        <Box marginTop={1}>
          <ToolUseView
            name={item.name}
            detail={item.detail}
            status={item.status === 'error' ? 'error' : 'done'}
            animate={false}
          />
        </Box>
      );

    case 'tool_result':
      return (
        <Box marginTop={1}>
          <ToolResultView
            name={item.name}
            content={item.content}
            isError={item.isError}
            input={item.input}
          />
        </Box>
      );

    case 'system':
      return (
        <Box marginTop={1}>
          <SystemMessage level={item.level} text={item.text} />
        </Box>
      );

    case 'divider':
      return <Text dimColor>{'─'.repeat(50)}</Text>;

    default:
      return null;
  }
}
