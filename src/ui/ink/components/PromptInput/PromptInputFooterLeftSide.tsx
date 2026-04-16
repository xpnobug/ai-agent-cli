/**
 * PromptInputFooterLeftSide — 底部左侧信息栏
 *
 * 简化：去掉 Bridge/Tmux/Teams/Coordinator/PR/Selection/Voice 相关逻辑
 * 保留：退出提示 / 粘贴状态 / 历史搜索 / 模式提示 / 快捷键 byline
 */

import React from 'react';
import { Box, Text } from '../../primitives.js';
import { KeyboardShortcutHint } from '../design-system/KeyboardShortcutHint.js';
import { Byline } from '../design-system/Byline.js';
import { HistorySearchInput } from './HistorySearchInput.js';
import type { PromptInputMode } from './inputModes.js';

type Props = {
  /** 退出提示（双击 Esc/Ctrl+D） */
  exitMessage: { show: boolean; key?: string };
  /** 当前输入模式 */
  mode: PromptInputMode;
  /** 是否正在粘贴 */
  isPasting: boolean;
  /** 是否正在搜索历史 */
  isSearching: boolean;
  /** 历史搜索查询 */
  historyQuery: string;
  /** 历史搜索查询变更 */
  setHistoryQuery: (query: string) => void;
  /** 历史搜索是否未匹配 */
  historyFailedMatch: boolean;
  /** 是否隐藏快捷键提示 */
  suppressHint: boolean;
  /** 是否正在加载 */
  isLoading: boolean;
};

/**
 * ModeIndicator — 模式 + 快捷键提示
 */
function ModeIndicator({
  mode,
  showHint,
}: {
  mode: PromptInputMode;
  showHint: boolean;
}): React.ReactNode {
  const modeName =
    mode === 'bash' ? 'bash' : mode === 'plan' ? 'plan' : undefined;

  return (
    <Text dimColor>
      <Byline>
        {modeName && (
          <Text color={mode === 'bash' ? 'yellow' : mode === 'plan' ? 'yellow' : undefined} bold>
            {modeName}
          </Text>
        )}
        {showHint && (
          <>
            <KeyboardShortcutHint shortcut="?" action="帮助" />
            <KeyboardShortcutHint shortcut="/help" action="命令" />
          </>
        )}
      </Byline>
    </Text>
  );
}

export function PromptInputFooterLeftSide({
  exitMessage,
  mode,
  isPasting,
  isSearching,
  historyQuery,
  setHistoryQuery,
  historyFailedMatch,
  suppressHint,
  isLoading: _isLoading,
}: Props): React.ReactNode {
  // 退出提示
  if (exitMessage.show) {
    return (
      <Text dimColor>
        再按一次 {exitMessage.key ?? 'Esc'} 退出
      </Text>
    );
  }

  // 粘贴中
  if (isPasting) {
    return <Text dimColor>正在粘贴文本…</Text>;
  }

  return (
    <Box justifyContent="flex-start" gap={1}>
      {/* 历史搜索输入 */}
      {isSearching && (
        <HistorySearchInput
          value={historyQuery}
          onChange={setHistoryQuery}
          historyFailedMatch={historyFailedMatch}
        />
      )}
      {/* 模式 + 快捷键提示 */}
      {!isSearching && (
        <ModeIndicator mode={mode} showHint={!suppressHint} />
      )}
    </Box>
  );
}
