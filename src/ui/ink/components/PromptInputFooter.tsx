/**
 * PromptInputFooter — 输入框底部信息栏编排器
 *
 * 优先级：补全列表 > 帮助菜单 > 正常 footer
 * 补全激活时直接替代整个 footer 区域。
 */

import React from 'react';
import { Box, Text } from '../primitives.js';
import { PromptInputHelpMenu } from './PromptInputHelpMenu.js';
import { PromptInputFooterLeftSide } from './PromptInput/PromptInputFooterLeftSide.js';
import { Notifications } from './Notifications.js';
import { StatusLine } from './StatusLine.js';
import type { PromptInputMode } from './PromptInput/inputModes.js';
import type { ContextTokenUsage } from '../types.js';
import type { TokenStatsSnapshot } from './EnhancedSpinner.js';

// ─── 补全建议行渲染 ───

interface SuggestionItem {
  value: string;
  displayValue: string;
  description?: string;
}

function PromptInputFooterSuggestions({
  suggestions,
  selectedSuggestion,
  columns,
}: {
  suggestions: SuggestionItem[];
  selectedSuggestion: number;
  columns: number;
}): React.ReactNode {
  if (suggestions.length === 0) return null;

  const OVERLAY_MAX_ITEMS = 6;

  // 左列宽度：命令名最大长度 + padding，上限终端 40%
  const maxNameLen = Math.max(...suggestions.map(s => s.displayValue.length), 0);
  const displayTextWidth = Math.min(maxNameLen + 5, Math.floor(columns * 0.4));

  // 可见窗口（选中项居中）
  const startIndex = Math.max(0, Math.min(
    selectedSuggestion - Math.floor(OVERLAY_MAX_ITEMS / 2),
    suggestions.length - OVERLAY_MAX_ITEMS,
  ));
  const endIndex = Math.min(startIndex + OVERLAY_MAX_ITEMS, suggestions.length);
  const visibleItems = suggestions.slice(startIndex, endIndex);

  return (
    <Box flexDirection="column" paddingX={2}>
      {visibleItems.map((item, i) => {
        const actualIndex = startIndex + i;
        const isSelected = actualIndex === selectedSuggestion;
        const shouldDim = !isSelected;

        // 左列：pad 到固定宽度
        let name = item.displayValue;
        if (name.length > displayTextWidth - 2) {
          name = name.slice(0, displayTextWidth - 3) + '…';
        }
        const paddedName = name + ' '.repeat(Math.max(0, displayTextWidth - name.length));

        // 右列：描述截断
        const descWidth = Math.max(0, columns - displayTextWidth - 6);
        let desc = (item.description || '').replace(/\s+/g, ' ');
        if (desc.length > descWidth) {
          desc = desc.slice(0, descWidth - 1) + '…';
        }

        return (
          <Text key={`${item.value}-${actualIndex}`} wrap="truncate">
            <Text color={isSelected ? 'blueBright' : undefined} dimColor={shouldDim} bold={isSelected}>{paddedName}</Text>
            <Text color={isSelected ? 'blueBright' : undefined} dimColor={shouldDim} bold={isSelected}>{desc}</Text>
          </Text>
        );
      })}
    </Box>
  );
}

// ─── Props ───

type Props = {
  helpOpen: boolean;
  tokenInfo?: string | null;
  columns: number;
  mode: PromptInputMode;
  exitMessage: { show: boolean; key?: string };
  isPasting: boolean;
  isSearching: boolean;
  historyQuery: string;
  setHistoryQuery: (query: string) => void;
  historyFailedMatch: boolean;
  contextTokenUsage?: ContextTokenUsage | null;
  modelName?: string;
  provider?: string;
  getTokenStats?: () => TokenStatsSnapshot;
  /** 补全建议列表 */
  suggestions?: SuggestionItem[];
  /** 当前选中的补全索引 */
  selectedSuggestion?: number;
};

export function PromptInputFooter({
  helpOpen,
  tokenInfo,
  columns,
  mode,
  exitMessage,
  isPasting,
  isSearching,
  historyQuery,
  setHistoryQuery,
  historyFailedMatch,
  contextTokenUsage,
  modelName,
  provider,
  getTokenStats,
  suggestions,
  selectedSuggestion,
}: Props): React.ReactNode {
  // 补全列表激活时替代整个 footer
  if (suggestions && suggestions.length > 0) {
    return (
      <PromptInputFooterSuggestions
        suggestions={suggestions}
        selectedSuggestion={selectedSuggestion ?? 0}
        columns={columns}
      />
    );
  }

  // 帮助菜单打开时替换整个 footer
  if (helpOpen) {
    return <PromptInputHelpMenu dimColor fixedWidth paddingX={2} />;
  }

  const isNarrow = columns < 80;

  return (
    <>
      <StatusLine
        modelName={modelName}
        provider={provider}
        getTokenStats={getTokenStats}
      />
      <Notifications tokenUsage={contextTokenUsage ?? null} />
      <Box
        flexDirection={isNarrow ? 'column' : 'row'}
        justifyContent={isNarrow ? 'flex-start' : 'space-between'}
        width={columns - 1}
        gap={isNarrow ? 0 : 1}
      >
        <Box flexShrink={isNarrow ? 0 : 1}>
          <PromptInputFooterLeftSide
            exitMessage={exitMessage}
            mode={mode}
            isPasting={isPasting}
            isSearching={isSearching}
            historyQuery={historyQuery}
            setHistoryQuery={setHistoryQuery}
            historyFailedMatch={historyFailedMatch}
            suppressHint={isSearching}
            isLoading={false}
          />
        </Box>
        {tokenInfo && (
          <Box flexShrink={1}>
            <Text dimColor wrap="truncate-end">{tokenInfo}</Text>
          </Box>
        )}
      </Box>
    </>
  );
}
