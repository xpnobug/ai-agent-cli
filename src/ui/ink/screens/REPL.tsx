/**
 * REPL — 主屏幕编排器
 *
 * 从 AppStateStore 订阅所有状态切片，组装 FullscreenLayout 的插槽。
 */

import React, { useRef, useEffect, useState } from 'react';
import type { AppStateStore } from '../store.js';
import { useAppState } from '../hooks.js';
import { FullscreenLayout, useUnseenDivider } from '../components/FullscreenLayout.js';
import { Messages } from '../components/Messages.js';
import { RequestStatusIndicator } from '../components/RequestStatusIndicator.js';
import type { TokenStatsSnapshot } from '../components/EnhancedSpinner.js';
import { UserInput } from '../components/UserInput.js';
import { PermissionPrompt } from '../components/PermissionPrompt.js';
import { QuestionPrompt } from '../components/QuestionPrompt.js';
import { SessionSelector } from '../components/SessionSelector.js';
import { TaskSelector } from '../components/TaskSelector.js';
import type { AskUserQuestionDef } from '../types.js';
import type { SlashCommandItem } from '../completion/types.js';
import { useCancelRequest } from '../hooks/useCancelRequest.js';
import { useExitOnCtrlCD } from '../hooks/useExitOnCtrlCD.js';
import { useCommandKeybindings } from '../hooks/useCommandKeybindings.js';
import { ScrollKeybindingHandler } from '../components/ScrollKeybindingHandler.js';
import { QuickOpenDialog } from '../components/QuickOpenDialog.js';
import { GlobalSearchDialog } from '../components/GlobalSearchDialog.js';
import { HelpV2 } from '../components/HelpV2/HelpV2.js';
import { Settings } from '../components/Settings/Settings.js';
import { ExportDialog } from '../components/ExportDialog.js';
import { ModelPicker } from '../components/ModelPicker.js';
import { ThemePicker } from '../components/ThemePicker.js';
import { Stats } from '../components/Stats.js';
import { DiagnosticsDisplay } from '../components/DiagnosticsDisplay.js';
import { MessageSelector } from '../components/MessageSelector.js';
import { OutputStylePicker } from '../components/OutputStylePicker.js';
import { LanguagePicker } from '../components/LanguagePicker.js';
import { LogSelector } from '../components/LogSelector.js';
import { ConfigSetDialog } from '../components/ConfigSetDialog.js';
import { CustomSelect } from '../components/CustomSelect/index.js';
import { buildMascotOptions } from '../components/configShared.js';
import { Mascot } from '../components/LogoV2/Mascot.js';
import { MemoryUsageIndicator } from '../components/MemoryUsageIndicator.js';
import { useCopyOnSelect } from '../hooks/useCopyOnSelect.js';
import { useNotifyAfterTimeout } from '../hooks/useNotifyAfterTimeout.js';
import type { ScrollBoxHandle } from '../primitives.js';
import { setFocus } from '../store.js';

export interface REPLProps {
  store: AppStateStore;
  onInput: (text: string) => void;
  onExit: () => void;
  onInterrupt: () => void;
  slashCommands: SlashCommandItem[];
  getTokenStats?: () => TokenStatsSnapshot;
  /** 当前模型显示名，用于状态栏 */
  modelName?: string;
  /** 当前 provider，用于状态栏上下文 */
  provider?: string;
}

export function REPL({ store, onInput, onExit, onInterrupt, slashCommands, getTokenStats, modelName, provider }: REPLProps) {
  const completedItems = useAppState(store, (s) => s.completedItems);
  const activeToolUses = useAppState(store, (s) => s.activeToolUses);
  const streaming = useAppState(store, (s) => s.streaming);
  const loading = useAppState(store, (s) => s.loading);
  const focus = useAppState(store, (s) => s.focus);
  const tokenInfo = useAppState(store, (s) => s.tokenInfo);
  const contextTokenUsage = useAppState(store, (s) => s.contextTokenUsage);

  const scrollRef = useRef<ScrollBoxHandle>(null);
  const [columns, setColumns] = useState(process.stdout.columns || 80);
  const isLoading = Boolean(loading || streaming || activeToolUses.length > 0);

  // 终端 resize 追踪
  useEffect(() => {
    const onResize = () => setColumns(process.stdout.columns || 80);
    process.stdout.on('resize', onResize);
    return () => { process.stdout.off('resize', onResize); };
  }, []);

  useCancelRequest({ isLoading, focus, onInterrupt });
  useExitOnCtrlCD({ focus, isLoading, onExit });
  useCopyOnSelect(!focus);
  useNotifyAfterTimeout({ isLoading });
  useCommandKeybindings({
    store,
    enabled: !focus && !isLoading,
  });

  // ─── 未读分割线追踪 ───
  const { dividerYRef, onScrollAway, onRepin, jumpToNew, newMessageCount } =
    useUnseenDividerAdapter(completedItems.length, scrollRef);

  // ─── scrollable：消息 + spinner ───
  const scrollable = (
    <>
      <Messages
        completedItems={completedItems}
        activeToolUses={activeToolUses}
        streaming={streaming}
        scrollRef={scrollRef}
        columns={columns}
      />
      {isLoading && !focus && (
        <RequestStatusIndicator getTokenStats={getTokenStats} />
      )}
      {contextTokenUsage && !isLoading && !focus && (
        <MemoryUsageIndicator
          currentTokens={contextTokenUsage.currentTokens}
          maxTokens={contextTokenUsage.maxTokens}
        />
      )}
    </>
  );

  // ─── overlay：权限弹窗（在 ScrollBox 内，用户可回滚查看上下文） ───
  const overlay = focus?.type === 'permission' ? (
    <PermissionPrompt
      toolName={focus.toolName}
      params={focus.params}
      reason={focus.reason}
      commandPrefix={focus.commandPrefix}
      commandInjectionDetected={focus.commandInjectionDetected}
      onResolve={focus.resolve}
    />
  ) : undefined;

  // ─── bottom：对话框 / 输入框 ───
  const bottom = (
    <>
      {focus?.type === 'question' && (
        <QuestionPrompt
          questions={focus.questions as AskUserQuestionDef[]}
          initialAnswers={focus.initialAnswers}
          onResolve={focus.resolve}
        />
      )}
      {focus?.type === 'session_selector' && (
        <SessionSelector
          sessions={focus.sessions}
          onSelect={(index) => focus.resolve(index)}
          onCancel={() => focus.resolve(null)}
        />
      )}
      {focus?.type === 'task_selector' && (
        <TaskSelector
          tasks={focus.tasks}
          onAction={(action, taskId) => focus.resolve({ action, taskId })}
          onCancel={() => focus.resolve(null)}
        />
      )}
      {focus?.type === 'quick_open' && (
        <QuickOpenDialog
          workdir={focus.workdir}
          onDone={() => setFocus(store, undefined)}
          onInsert={focus.onInsert}
        />
      )}
      {focus?.type === 'global_search' && (
        <GlobalSearchDialog
          workdir={focus.workdir}
          onDone={() => setFocus(store, undefined)}
          onInsert={focus.onInsert}
        />
      )}
      {focus?.type === 'help_panel' && (
        <HelpV2
          commands={focus.commands}
          onClose={() => { focus.resolve(); setFocus(store, undefined); }}
        />
      )}
      {focus?.type === 'settings_panel' && (
        <Settings
          config={focus.config}
          usage={focus.usage}
          onClose={() => { focus.resolve(); setFocus(store, undefined); }}
        />
      )}
      {focus?.type === 'export_dialog' && (
        <ExportDialog
          onExport={(fmt) => { focus.resolve(fmt); setFocus(store, undefined); }}
          onCancel={() => { focus.resolve(null); setFocus(store, undefined); }}
        />
      )}
      {focus?.type === 'model_picker' && (
        <ModelPicker
          currentModel={focus.currentModel}
          provider={focus.provider}
          onSelect={(model) => { focus.resolve(model); setFocus(store, undefined); }}
          onCancel={() => { focus.resolve(null); setFocus(store, undefined); }}
        />
      )}
      {focus?.type === 'theme_picker' && (
        <ThemePicker
          currentTheme=""
          themes={[
            { id: 'auto', name: 'Auto', description: '跟随系统深色/浅色' },
            { id: 'dark', name: 'Dark', description: 'RGB 深色（默认）' },
            { id: 'light', name: 'Light', description: 'RGB 浅色' },
            { id: 'dark-ansi', name: 'Dark ANSI', description: '16 色深色（兼容性最好）' },
            { id: 'light-ansi', name: 'Light ANSI', description: '16 色浅色' },
            { id: 'dark-daltonized', name: 'Dark 色盲友好', description: '深色色盲优化' },
            { id: 'light-daltonized', name: 'Light 色盲友好', description: '浅色色盲优化' },
          ]}
          onSelect={(theme) => { focus.resolve(theme); setFocus(store, undefined); }}
          onCancel={() => { focus.resolve(null); setFocus(store, undefined); }}
        />
      )}
      {focus?.type === 'stats_panel' && (
        <Stats
          data={focus.data}
          onClose={() => { focus.resolve(); setFocus(store, undefined); }}
        />
      )}
      {focus?.type === 'diagnostics' && (
        <DiagnosticsDisplay
          checks={focus.checks}
          onClose={() => { focus.resolve(); setFocus(store, undefined); }}
        />
      )}
      {focus?.type === 'message_selector' && (
        <MessageSelector
          items={completedItems}
          onSelect={(index) => { focus.resolve(index); setFocus(store, undefined); }}
          onCancel={() => { focus.resolve(null); setFocus(store, undefined); }}
        />
      )}
      {focus?.type === 'output_style_picker' && (
        <OutputStylePicker
          currentStyle={focus.currentStyle as any}
          onSelect={(style) => { focus.resolve(style); setFocus(store, undefined); }}
          onCancel={() => { focus.resolve(null); setFocus(store, undefined); }}
        />
      )}
      {focus?.type === 'language_picker' && (
        <LanguagePicker
          currentLanguage={focus.currentLanguage}
          onSelect={(lang) => { focus.resolve(lang); setFocus(store, undefined); }}
          onCancel={() => { focus.resolve(null); setFocus(store, undefined); }}
        />
      )}
      {focus?.type === 'log_selector' && (
        <LogSelector
          currentLevel={focus.currentLevel as any}
          onSelect={(level) => { focus.resolve(level); setFocus(store, undefined); }}
          onCancel={() => { focus.resolve(null); setFocus(store, undefined); }}
        />
      )}
      {focus?.type === 'config_set' && (
        <ConfigSetDialog
          currentProvider={focus.currentProvider}
          currentModel={focus.currentModel}
          currentBaseUrl={focus.currentBaseUrl}
          onDone={(result) => { focus.resolve(result); setFocus(store, undefined); }}
        />
      )}
      {focus?.type === 'mascot_picker' && (
        <React.Fragment>
          <Mascot variant={focus.currentMascot} />
          <CustomSelect
            options={buildMascotOptions()}
            defaultValue={focus.currentMascot}
            onChange={(value) => { focus.resolve(value); setFocus(store, undefined); }}
            onCancel={() => { focus.resolve(null); setFocus(store, undefined); }}
          />
        </React.Fragment>
      )}
      {!focus && (
        <UserInput
          slashCommands={slashCommands}
          onSubmit={onInput}
          onExit={onExit}
          tokenInfo={tokenInfo}
          contextTokenUsage={contextTokenUsage}
          modelName={modelName}
          provider={provider}
          getTokenStats={getTokenStats}
        />
      )}
    </>
  );

  return (
    <>
      {/* 滚动快捷键处理器（有弹窗时禁用） */}
      <ScrollKeybindingHandler
        scrollRef={scrollRef}
        isActive={!focus}
        onScroll={(sticky, handle) => {
          if (!sticky) {
            onScrollAway(handle);
          } else {
            onRepin();
          }
        }}
      />

      {/* 全屏布局 */}
      <FullscreenLayout
        scrollable={scrollable}
        bottom={bottom}
        overlay={overlay}
        scrollRef={scrollRef}
        dividerYRef={dividerYRef}
        newMessageCount={newMessageCount}
        onPillClick={() => jumpToNew(scrollRef.current)}
      />
    </>
  );
}

/**
 * useUnseenDivider 适配器
 * 将 FullscreenLayout 的 useUnseenDivider 包装为 REPL 需要的接口，
 * 增加 newMessageCount 计算。
 */
function useUnseenDividerAdapter(
  messageCount: number,
  scrollRef: React.RefObject<ScrollBoxHandle | null>,
) {
  const { dividerIndex, dividerYRef, onScrollAway, onRepin, jumpToNew } =
    useUnseenDivider(messageCount);

  // 新消息计数：当前消息数 - 快照时的消息数
  const newMessageCount = dividerIndex !== null
    ? Math.max(0, messageCount - dividerIndex)
    : 0;

  // 滚动事件监听：驱动 onScrollAway / onRepin
  useEffect(() => {
    const handle = scrollRef.current;
    if (!handle) return;
    return handle.subscribe(() => {
      if (!handle.isSticky()) {
        onScrollAway(handle);
      } else {
        onRepin();
      }
    });
  }, [scrollRef, onScrollAway, onRepin]);

  return { dividerYRef, onScrollAway, onRepin, jumpToNew, newMessageCount };
}
