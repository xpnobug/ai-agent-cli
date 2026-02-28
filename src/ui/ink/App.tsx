/**
 * Ink 根组件
 *
 * 使用 useAppStore 精确订阅外部 Store，
 * Static 固定已完成内容，流式文本独立渲染，DynamicArea 堆叠式布局。
 */

import { Static, Box } from 'ink';
import type { AppStore } from './store.js';
import { useAppStore } from './hooks.js';
import { CompletedItemView } from './components/CompletedItemView.js';
import { StreamingText } from './components/StreamingText.js';
import { DynamicArea } from './components/ActiveArea.js';
import type { KeybindingRegistry } from '../keybindings.js';
import type { TokenStatsSnapshot } from './components/EnhancedSpinner.js';

export interface AppProps {
  store: AppStore;
  onInput: (text: string) => void;
  onExit: () => void;
  commandNames: string[];
  keybindingRegistry?: KeybindingRegistry;
  getTokenStats?: () => TokenStatsSnapshot;
}

export function App({ store, onInput, onExit, commandNames, keybindingRegistry, getTokenStats }: AppProps) {
  // 精确订阅：只在对应 slice 变化时重渲染
  const completedItems = useAppStore(store, (s) => s.completedItems);
  const loading = useAppStore(store, (s) => s.loading);
  const streaming = useAppStore(store, (s) => s.streaming);
  const focus = useAppStore(store, (s) => s.focus);
  const tokenInfo = useAppStore(store, (s) => s.tokenInfo);

  return (
    <Box flexDirection="column">
      <Static items={completedItems}>
        {(item) => <CompletedItemView key={item.id} item={item} />}
      </Static>

      {/* 流式文本 — 独立渲染，在 DynamicArea 之上 */}
      {streaming && <StreamingText text={streaming.text} />}

      {/* 动态区域 — 堆叠式 */}
      <DynamicArea
        loading={loading}
        focus={focus}
        onInput={onInput}
        onExit={onExit}
        commandNames={commandNames}
        keybindingRegistry={keybindingRegistry}
        getTokenStats={getTokenStats}
        tokenInfo={tokenInfo}
      />
    </Box>
  );
}
