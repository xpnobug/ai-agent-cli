/**
 * Keybindings parser / 显示格式化
 *
 * 对照源：claude-code-sourcemap/src/keybindings/parser.ts
 * 本文件纯逻辑，无 Ink / 外部依赖，便于测试。
 */

import type { Chord, KeybindingBlock, ParsedBinding, ParsedKeystroke } from './types.js';

/** 解析形如 "ctrl+shift+k" 的单键击字符串 */
export function parseKeystroke(input: string): ParsedKeystroke {
  const parts = input.split('+');
  const ks: ParsedKeystroke = {
    key: '',
    ctrl: false,
    alt: false,
    shift: false,
    meta: false,
    super: false,
  };
  for (const part of parts) {
    const lower = part.toLowerCase();
    switch (lower) {
      case 'ctrl':
      case 'control':
        ks.ctrl = true;
        break;
      case 'alt':
      case 'opt':
      case 'option':
        ks.alt = true;
        break;
      case 'shift':
        ks.shift = true;
        break;
      case 'meta':
        ks.meta = true;
        break;
      case 'cmd':
      case 'command':
      case 'super':
      case 'win':
        ks.super = true;
        break;
      case 'esc':
        ks.key = 'escape';
        break;
      case 'return':
        ks.key = 'enter';
        break;
      case 'space':
        ks.key = ' ';
        break;
      case '↑':
        ks.key = 'up';
        break;
      case '↓':
        ks.key = 'down';
        break;
      case '←':
        ks.key = 'left';
        break;
      case '→':
        ks.key = 'right';
        break;
      default:
        ks.key = lower;
        break;
    }
  }
  return ks;
}

/** 解析和弦字符串：以空白分隔多个键击；单独一个空格字符代表 "空格键" 本身。 */
export function parseChord(input: string): Chord {
  if (input === ' ') return [parseKeystroke('space')];
  return input.trim().split(/\s+/).map(parseKeystroke);
}

/** 内部键名 → 显示名 */
function keyToDisplayName(key: string): string {
  switch (key) {
    case 'escape':
      return 'Esc';
    case ' ':
      return 'Space';
    case 'tab':
      return 'tab';
    case 'enter':
      return 'Enter';
    case 'backspace':
      return 'Backspace';
    case 'delete':
      return 'Delete';
    case 'up':
      return '↑';
    case 'down':
      return '↓';
    case 'left':
      return '←';
    case 'right':
      return '→';
    case 'pageup':
      return 'PageUp';
    case 'pagedown':
      return 'PageDown';
    case 'home':
      return 'Home';
    case 'end':
      return 'End';
    default:
      return key;
  }
}

/** 转为规范显示字符串（跨平台通用） */
export function keystrokeToString(ks: ParsedKeystroke): string {
  const parts: string[] = [];
  if (ks.ctrl) parts.push('ctrl');
  if (ks.alt) parts.push('alt');
  if (ks.shift) parts.push('shift');
  if (ks.meta) parts.push('meta');
  if (ks.super) parts.push('cmd');
  parts.push(keyToDisplayName(ks.key));
  return parts.join('+');
}

export function chordToString(chord: Chord): string {
  return chord.map(keystrokeToString).join(' ');
}

/** 平台显示（macOS 用 opt/cmd，其他用 alt/super） */
export type DisplayPlatform = 'macos' | 'windows' | 'linux' | 'wsl' | 'unknown';

export function keystrokeToDisplayString(
  ks: ParsedKeystroke,
  platform: DisplayPlatform = 'linux',
): string {
  const parts: string[] = [];
  if (ks.ctrl) parts.push('ctrl');
  if (ks.alt || ks.meta) {
    parts.push(platform === 'macos' ? 'opt' : 'alt');
  }
  if (ks.shift) parts.push('shift');
  if (ks.super) {
    parts.push(platform === 'macos' ? 'cmd' : 'super');
  }
  parts.push(keyToDisplayName(ks.key));
  return parts.join('+');
}

export function chordToDisplayString(
  chord: Chord,
  platform: DisplayPlatform = 'linux',
): string {
  return chord.map((ks) => keystrokeToDisplayString(ks, platform)).join(' ');
}

/** 把 JSON 配置块展平为一维绑定列表 */
export function parseBindings(blocks: KeybindingBlock[]): ParsedBinding[] {
  const bindings: ParsedBinding[] = [];
  for (const block of blocks) {
    for (const [keyStr, action] of Object.entries(block.bindings)) {
      bindings.push({
        chord: parseChord(keyStr),
        action,
        context: block.context,
      });
    }
  }
  return bindings;
}
