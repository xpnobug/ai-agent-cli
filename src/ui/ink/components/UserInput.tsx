/**
 * UserInput — 用户输入组件（全功能域重构）
 *
 * 集成子组件：
 *   - PromptInputModeIndicator — 模式指示符
 *   - PromptInputFooter — 底部信息栏编排器（含 FooterLeftSide/HelpMenu）
 *   - inputModes — 输入模式切换（! → bash）
 *   - usePromptInputPlaceholder — 动态占位符
 *   - useMaybeTruncateInput — 长输入截断
 */

import { useCallback, useState } from 'react';
import { Box, Text, useInput } from '../primitives.js';
import TextInput from './TextInput.js';
import { useEmacsBindings } from './BaseTextInput.js';
import { useSlashCompletion } from '../hooks/useSlashCompletion.js';
import { useInputBuffer } from '../hooks/useInputBuffer.js';
import {
  ArrowKeyHistory,
  useArrowKeyHistory,
} from '../hooks/useArrowKeyHistory.js';
import { useSetPromptOverlay } from '../context/promptOverlayContext.js';
import type { SlashCommandItem } from '../completion/types.js';
import type { TokenStatsSnapshot } from './EnhancedSpinner.js';
import type { ContextTokenUsage } from '../types.js';
import { PromptInputModeIndicator } from './PromptInputModeIndicator.js';
import { PromptInputFooter } from './PromptInputFooter.js';
import { PromptInputStashNotice } from './PromptInput/PromptInputStashNotice.js';
import { isInputModeCharacter } from './PromptInput/inputModes.js';
import type { PromptInputMode } from './PromptInput/inputModes.js';
import { usePromptInputPlaceholder } from '../hooks/usePromptInputPlaceholder.js';
import { useMaybeTruncateInput } from '../hooks/useMaybeTruncateInput.js';
import { useDoublePress } from '../hooks/useDoublePress.js';

export interface UserInputProps {
  slashCommands: SlashCommandItem[];
  onSubmit: (text: string) => void;
  onExit: () => void;
  tokenInfo?: string | null;
  contextTokenUsage?: ContextTokenUsage | null;
  modelName?: string;
  provider?: string;
  getTokenStats?: () => TokenStatsSnapshot;
}

/**
 * 用户输入历史记录。
 * 模块级实例，保证一次 CLI 会话内多次渲染/重挂载仍共享同一份历史。
 */
const commandHistory = new ArrowKeyHistory();
let submitCount = 0;

export function UserInput({
  slashCommands,
  onSubmit,
  onExit,
  tokenInfo,
  contextTokenUsage,
  modelName,
  provider,
  getTokenStats,
}: UserInputProps) {
  const {
    value,
    cursorOffset,
    setValue,
    setCursorOffset,
    replaceValue,
    clear,
  } = useInputBuffer();

  // ─── 状态 ───
  const [helpOpen, setHelpOpen] = useState(false);
  const [mode, setMode] = useState<PromptInputMode>('prompt');
  const [isSearchingHistory, setIsSearchingHistory] = useState(false);

  // ─── Emacs 快捷键 (Ctrl+A/E/K/U/W) ───
  useEmacsBindings({
    value,
    cursorOffset,
    onChange: setValue,
    setCursorOffset,
    enabled: !isSearchingHistory,
  });
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyFailedMatch, setHistoryFailedMatch] = useState(false);
  const [exitMessage, setExitMessage] = useState<{ show: boolean; key?: string }>({ show: false });
  const [stashedPrompt, setStashedPrompt] = useState<string | undefined>(undefined);

  const terminalColumns = process.stdout.columns || 80;
  const columns = Math.max(10, terminalColumns - 2);

  // ─── 长输入截断 ───
  useMaybeTruncateInput({ input: value, onInputChange: setValue, setCursorOffset });

  // ─── 动态占位符 ───
  const placeholder = usePromptInputPlaceholder({ input: value, submitCount });

  // ─── 输入模式检测 ───
  const handleInputChange = useCallback((newValue: string) => {
    // 检测 ! 前缀切换 bash 模式
    if (newValue.length === 1 && isInputModeCharacter(newValue)) {
      setMode('bash');
      setValue('');
      return;
    }
    // 空输入时退出 bash 模式
    if (newValue === '' && mode === 'bash') {
      setMode('prompt');
    }
    setValue(newValue);
  }, [mode, setValue]);

  // ─── Slash 补全 ───
  const {
    suggestions,
    selectedIndex,
    isActive: completionActive,
  } = useSlashCompletion({
    input: value,
    cursorOffset,
    onInputChange: setValue,
    setCursorOffset,
    commands: slashCommands,
  });

  // 补全数据不再推到上方 overlay，改为在 footer 内直接渲染
  useSetPromptOverlay(null);

  // ─── 历史导航 ───
  const {
    handleHistoryUp,
    handleHistoryDown,
    addHistoryEntry,
    resetHistoryNavigation,
  } = useArrowKeyHistory({
    history: commandHistory,
    getCurrentInput: () => value,
    applyInput: replaceValue,
    onCursorOffsetChange: setCursorOffset,
    disabled: completionActive || isSearchingHistory,
  });

  // ─── 提交 ───
  const handleSubmit = useCallback((text: string) => {
    if (completionActive && suggestions.length > 0) return;

    if (helpOpen) setHelpOpen(false);
    if (isSearchingHistory) setIsSearchingHistory(false);

    // bash 模式前缀
    const finalText = mode === 'bash' ? `!${text.trim()}` : text.trim();

    if (finalText) {
      addHistoryEntry(finalText);
      submitCount++;
    }

    clear();
    setMode('prompt');

    // 恢复 stash
    if (stashedPrompt) {
      setValue(stashedPrompt);
      setStashedPrompt(undefined);
    }

    onSubmit(finalText);
  }, [addHistoryEntry, clear, completionActive, helpOpen, isSearchingHistory, mode, onSubmit, setValue, stashedPrompt, suggestions.length]);

  // ─── 双击 Esc 退出提示 ───
  const doublePressEsc = useDoublePress(
    (pending) => {
      if (pending) {
        setExitMessage({ show: true, key: 'Esc' });
      } else {
        setExitMessage({ show: false });
      }
    },
    () => {
      // 双击 Esc：清除退出提示
      setExitMessage({ show: false });
    },
  );

  // ─── 键盘事件处理 ───
  useInput((input, key) => {
    // ? 切换帮助菜单（仅空输入时）
    if (input === '?' && !completionActive && value === '') {
      setHelpOpen((prev) => !prev);
      return;
    }

    // Esc 处理
    if (key.escape) {
      if (helpOpen) { setHelpOpen(false); return; }
      if (isSearchingHistory) { setIsSearchingHistory(false); setHistoryQuery(''); return; }
      if (mode === 'bash' && value === '') { setMode('prompt'); return; }
      if (value === '') { doublePressEsc(); return; }
    }

    // Ctrl+R 打开内联历史搜索
    if (key.ctrl && input === 'r') {
      if (!isSearchingHistory) {
        // 暂存当前输入
        if (value) setStashedPrompt(value);
        setIsSearchingHistory(true);
        setHistoryQuery('');
        setHistoryFailedMatch(false);
      }
      return;
    }
  });

  // ─── 历史搜索逻辑 ───
  const handleHistoryQueryChange = useCallback((query: string) => {
    setHistoryQuery(query);
    if (!query) {
      setHistoryFailedMatch(false);
      return;
    }
    const q = query.toLowerCase();
    const match = commandHistory.getAll().find((entry) => entry.toLowerCase().includes(q));
    if (match) {
      setHistoryFailedMatch(false);
      replaceValue(match);
    } else {
      setHistoryFailedMatch(true);
    }
  }, [replaceValue]);

  return (
    <Box flexDirection="column" marginTop={1}>
      {/* 分隔线 */}
      <Text dimColor>{'─'.repeat(terminalColumns - 1)}</Text>

      {/* Stash 提示 */}
      <PromptInputStashNotice hasStash={stashedPrompt !== undefined} />

      {/* 输入区域 */}
      <Box>
        <PromptInputModeIndicator mode={mode} isLoading={false} />
        <Box flexGrow={1} flexShrink={1}>
          <TextInput
            multiline
            focus={!isSearchingHistory}
            value={value}
            onChange={handleInputChange}
            onSubmit={handleSubmit}
            onHistoryUp={handleHistoryUp}
            onHistoryDown={handleHistoryDown}
            onHistoryReset={resetHistoryNavigation}
            onExit={onExit}
            columns={columns}
            cursorOffset={cursorOffset}
            onChangeCursorOffset={setCursorOffset}
            disableCursorMovementForUpDownKeys={completionActive}
            placeholder={placeholder}
          />
        </Box>
      </Box>

      {/* 分隔线 */}
      <Text dimColor>{'─'.repeat(terminalColumns - 1)}</Text>

      {/* Footer 编排器 */}
      <PromptInputFooter
        helpOpen={helpOpen}
        tokenInfo={tokenInfo}
        columns={terminalColumns}
        mode={mode}
        exitMessage={exitMessage}
        isPasting={false}
        isSearching={isSearchingHistory}
        historyQuery={historyQuery}
        setHistoryQuery={handleHistoryQueryChange}
        historyFailedMatch={historyFailedMatch}
        contextTokenUsage={contextTokenUsage}
        modelName={modelName}
        provider={provider}
        getTokenStats={getTokenStats}
        suggestions={completionActive ? suggestions.map((s) => ({
          value: s.value,
          displayValue: s.displayValue,
          description: s.description,
        })) : undefined}
        selectedSuggestion={selectedIndex}
      />
    </Box>
  );
}

/**
 * 获取命令历史
 */
export function getInputHistory(): string[] {
  return commandHistory.getAll();
}
