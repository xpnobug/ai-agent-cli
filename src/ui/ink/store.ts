/**
 * AppStore — 外部状态管理
 *
 * 用 useSyncExternalStore 替代 React Context + bind() 回调，
 * 实现精确订阅和 React 外读写。
 */

import type { AppPhase, CompletedItem, CompletedItemInput, BannerConfig, LoadingState, StreamingState, FocusTarget } from './types.js';
import { generateId } from './types.js';
import type { Theme } from '../theme.js';

/**
 * 应用状态
 */
export interface AppState {
  /** @deprecated 由 loading/streaming/focus 替代 */
  phase: AppPhase;
  completedItems: CompletedItem[];
  theme: Theme;
  loading: LoadingState;
  streaming: StreamingState;
  focus: FocusTarget;
  /** 输入框底部右侧的 token 使用信息 */
  tokenInfo: string | null;
}

/**
 * 外部 Store — React 外可读写，组件通过 useSyncExternalStore 精确订阅
 */
export class AppStore {
  private state: AppState;
  private listeners = new Set<() => void>();

  constructor(initialState: AppState) {
    this.state = initialState;
  }

  getState(): AppState {
    return this.state;
  }

  setState(updater: (prev: AppState) => Partial<AppState>): void {
    const partial = updater(this.state);
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((l) => l());
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ─── 便捷方法 ───

  /** @deprecated 使用 setLoading/setStreaming/setFocus 替代 */
  setPhase(phase: AppPhase): void {
    this.setState(() => ({ phase }));
  }

  addCompleted(item: CompletedItemInput): void {
    const fullItem = { ...item, id: generateId() } as CompletedItem;
    this.setState((prev) => ({
      completedItems: [...prev.completedItems, fullItem],
    }));
  }

  // ─── 正交状态操作 ───

  setLoading(loading: LoadingState): void {
    this.setState(() => ({ loading }));
  }

  setStreaming(streaming: StreamingState): void {
    this.setState(() => ({ streaming }));
  }

  setFocus(focus: FocusTarget): void {
    this.setState(() => ({ focus }));
  }

  setTokenInfo(info: string | null): void {
    this.setState(() => ({ tokenInfo: info }));
  }

  /** 清除所有动态状态回到输入模式 */
  resetToInput(): void {
    this.setState(() => ({
      phase: { type: 'input' as const },
      loading: null,
      streaming: null,
      focus: undefined,
    }));
  }

  /**
   * 创建带 banner 的初始状态
   */
  static createInitialState(theme: Theme, bannerConfig?: BannerConfig): AppState {
    const completedItems: CompletedItem[] = [];
    if (bannerConfig) {
      completedItems.push({ id: generateId(), type: 'banner' as const, config: bannerConfig });
    }
    return {
      phase: { type: 'input' },
      completedItems,
      theme,
      loading: null,
      streaming: null,
      focus: undefined,
      tokenInfo: null,
    };
  }
}
