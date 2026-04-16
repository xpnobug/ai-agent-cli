/**
 * useGlobalKeybindings — 全局快捷键注册
 *
 * 功能：统一注册全局快捷键（快速打开、全局搜索等）
 */

import { useCallback } from 'react';
import { useInput } from '../primitives.js';
import type { AppStateStore } from '../store.js';
import { setFocus } from '../store.js';

interface GlobalKeybindingsOptions {
  store: AppStateStore;
  /** 是否启用（有弹窗或加载中时应禁用） */
  enabled: boolean;
  /** 工作目录（用于搜索对话框） */
  workdir: string;
  /** 插入文本到输入框的回调 */
  onInsertText?: (text: string) => void;
}

/**
 * 注册全局快捷键。
 * 当 enabled=false 时所有快捷键不响应。
 */
export function useGlobalKeybindings({
  store,
  enabled,
  workdir,
  onInsertText,
}: GlobalKeybindingsOptions): void {
  const insertHandler = useCallback((text: string) => {
    onInsertText?.(text);
  }, [onInsertText]);

  useInput((input, key) => {
    if (!enabled) return;

    // Ctrl+P — 快速打开文件
    if (key.ctrl && input === 'p') {
      setFocus(store, {
        type: 'quick_open',
        workdir,
        onInsert: insertHandler,
      });
      return;
    }

    // Ctrl+Shift+F — 全局搜索
    // 在终端中 Ctrl+Shift+F 通常映射为 Ctrl+F 或特殊序列
    if (key.ctrl && input === 'f') {
      setFocus(store, {
        type: 'global_search',
        workdir,
        onInsert: insertHandler,
      });
      return;
    }
  });
}
