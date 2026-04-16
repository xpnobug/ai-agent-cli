/**
 * BaseTextInput — Emacs 风格文本输入
 *
 * 功能：在 TextInput 基础上增加 Emacs 快捷键支持。
 *   Ctrl+A: 行首 / Ctrl+E: 行尾 / Ctrl+K: 删到行尾
 *   Ctrl+U: 删到行首 / Ctrl+W: 删前一个单词
 */

import { useCallback } from 'react';
import { useInput } from '../primitives.js';

interface BaseTextInputOptions {
  value: string;
  cursorOffset: number;
  onChange: (value: string) => void;
  setCursorOffset: (offset: number) => void;
  enabled?: boolean;
}

/**
 * Hook：为现有输入组件添加 Emacs 快捷键支持。
 * 在 TextInput 的 useInput 之前调用，优先拦截 Ctrl 组合键。
 */
export function useEmacsBindings({
  value,
  cursorOffset,
  onChange,
  setCursorOffset,
  enabled = true,
}: BaseTextInputOptions): void {
  useInput(
    useCallback(
      (input: string, key: { ctrl?: boolean }) => {
        if (!key.ctrl) return;

        switch (input) {
          case 'a':
            // 跳到行首
            setCursorOffset(0);
            break;
          case 'e':
            // 跳到行尾
            setCursorOffset(value.length);
            break;
          case 'k': {
            // 删除光标到行尾
            const newValue = value.slice(0, cursorOffset);
            onChange(newValue);
            break;
          }
          case 'u': {
            // 删除光标到行首
            const newValue = value.slice(cursorOffset);
            onChange(newValue);
            setCursorOffset(0);
            break;
          }
          case 'w': {
            // 删除前一个单词
            const before = value.slice(0, cursorOffset);
            const match = before.match(/\S+\s*$/);
            if (match) {
              const newBefore = before.slice(0, before.length - match[0].length);
              onChange(newBefore + value.slice(cursorOffset));
              setCursorOffset(newBefore.length);
            }
            break;
          }
        }
      },
      [value, cursorOffset, onChange, setCursorOffset],
    ),
    { isActive: enabled },
  );
}
