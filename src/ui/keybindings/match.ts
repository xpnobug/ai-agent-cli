/**
 * 键击匹配：Ink Key + input → ParsedKeystroke 比对
 *
 * 对照源：claude-code-sourcemap/src/keybindings/match.ts
 * 这里使用 KeyLike 接口（Ink 4 Key 的子集 + 可选字段），避免和具体 Ink 版本强绑定。
 */

import type { ParsedBinding, ParsedKeystroke } from './types.js';

/** 与 Ink Key 形态兼容的最小子集（可选字段用于扩展协议 / 更高版本 Ink） */
export interface KeyLike {
  upArrow?: boolean;
  downArrow?: boolean;
  leftArrow?: boolean;
  rightArrow?: boolean;
  pageUp?: boolean;
  pageDown?: boolean;
  return?: boolean;
  escape?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  tab?: boolean;
  backspace?: boolean;
  delete?: boolean;
  meta?: boolean;
  /** kitty 协议下的 Cmd/Super/Win（多数终端不发送） */
  super?: boolean;
  home?: boolean;
  end?: boolean;
  wheelUp?: boolean;
  wheelDown?: boolean;
}

interface KeyModifiers {
  ctrl: boolean;
  shift: boolean;
  meta: boolean;
  super: boolean;
}

function getModifiers(key: KeyLike): KeyModifiers {
  return {
    ctrl: !!key.ctrl,
    shift: !!key.shift,
    meta: !!key.meta,
    super: !!key.super,
  };
}

/** 把 Ink Key + input 归一成内部键名（和 parser 的 key 字段对齐） */
export function getKeyName(input: string, key: KeyLike): string | null {
  if (key.escape) return 'escape';
  if (key.return) return 'enter';
  if (key.tab) return 'tab';
  if (key.backspace) return 'backspace';
  if (key.delete) return 'delete';
  if (key.upArrow) return 'up';
  if (key.downArrow) return 'down';
  if (key.leftArrow) return 'left';
  if (key.rightArrow) return 'right';
  if (key.pageUp) return 'pageup';
  if (key.pageDown) return 'pagedown';
  if (key.wheelUp) return 'wheelup';
  if (key.wheelDown) return 'wheeldown';
  if (key.home) return 'home';
  if (key.end) return 'end';
  if (input.length === 1) return input.toLowerCase();
  return null;
}

function modifiersMatch(mods: KeyModifiers, target: ParsedKeystroke): boolean {
  if (mods.ctrl !== target.ctrl) return false;
  if (mods.shift !== target.shift) return false;
  // Ink 把 Alt/Option 合并为 meta，alt/meta 视为等价
  const targetNeedsMeta = target.alt || target.meta;
  if (mods.meta !== targetNeedsMeta) return false;
  if (mods.super !== target.super) return false;
  return true;
}

export function matchesKeystroke(
  input: string,
  key: KeyLike,
  target: ParsedKeystroke,
): boolean {
  const keyName = getKeyName(input, key);
  if (keyName !== target.key) return false;

  const mods = getModifiers(key);
  // 怪癖：Ink 在按 Esc 时会同时置 meta=true；匹配单独 "escape" 绑定时忽略 meta。
  if (key.escape) {
    return modifiersMatch({ ...mods, meta: false }, target);
  }
  return modifiersMatch(mods, target);
}

/** 单键击绑定匹配（和弦第一阶段） */
export function matchesBinding(
  input: string,
  key: KeyLike,
  binding: ParsedBinding,
): boolean {
  if (binding.chord.length !== 1) return false;
  const ks = binding.chord[0];
  if (!ks) return false;
  return matchesKeystroke(input, key, ks);
}
