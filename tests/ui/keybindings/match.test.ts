import { describe, it, expect } from 'vitest';
import { parseKeystroke } from '../../../src/ui/keybindings/parser.js';
import {
  getKeyName,
  matchesKeystroke,
  matchesBinding,
  type KeyLike,
} from '../../../src/ui/keybindings/match.js';

function emptyKey(overrides: Partial<KeyLike> = {}): KeyLike {
  return {
    upArrow: false,
    downArrow: false,
    leftArrow: false,
    rightArrow: false,
    pageUp: false,
    pageDown: false,
    return: false,
    escape: false,
    ctrl: false,
    shift: false,
    tab: false,
    backspace: false,
    delete: false,
    meta: false,
    super: false,
    ...overrides,
  };
}

describe('getKeyName', () => {
  it('特殊键标志优先于 input', () => {
    expect(getKeyName('', emptyKey({ escape: true }))).toBe('escape');
    expect(getKeyName('', emptyKey({ return: true }))).toBe('enter');
    expect(getKeyName('', emptyKey({ upArrow: true }))).toBe('up');
  });

  it('单字符 input 小写化', () => {
    expect(getKeyName('A', emptyKey())).toBe('a');
  });

  it('多字符 input 无特殊键 → null', () => {
    expect(getKeyName('abc', emptyKey())).toBeNull();
  });
});

describe('matchesKeystroke', () => {
  it('ctrl+k 对上 ctrl=true & input=k', () => {
    const target = parseKeystroke('ctrl+k');
    expect(matchesKeystroke('k', emptyKey({ ctrl: true }), target)).toBe(true);
  });

  it('修饰键不匹配 → false', () => {
    const target = parseKeystroke('ctrl+k');
    expect(matchesKeystroke('k', emptyKey(), target)).toBe(false);
  });

  it('alt 和 meta 在 Ink 中等价', () => {
    const altTarget = parseKeystroke('alt+a');
    expect(matchesKeystroke('a', emptyKey({ meta: true }), altTarget)).toBe(true);
    const metaTarget = parseKeystroke('meta+a');
    expect(matchesKeystroke('a', emptyKey({ meta: true }), metaTarget)).toBe(true);
  });

  it('escape 单独绑定：Ink 的 meta quirk 被忽略', () => {
    const target = parseKeystroke('escape');
    // Ink 按 Esc 时会 meta=true；应匹配单独 escape 绑定
    expect(matchesKeystroke('', emptyKey({ escape: true, meta: true }), target)).toBe(true);
  });

  it('super/cmd 需要 key.super=true', () => {
    const target = parseKeystroke('cmd+a');
    expect(matchesKeystroke('a', emptyKey({ super: true }), target)).toBe(true);
    expect(matchesKeystroke('a', emptyKey({ meta: true }), target)).toBe(false);
  });

  it('shift 必须匹配', () => {
    const target = parseKeystroke('shift+a');
    expect(matchesKeystroke('A', emptyKey({ shift: true }), target)).toBe(true);
    expect(matchesKeystroke('a', emptyKey(), target)).toBe(false);
  });
});

describe('matchesBinding', () => {
  it('多键和弦 → 当前阶段不匹配单次输入（返回 false）', () => {
    const binding = {
      chord: [parseKeystroke('ctrl+k'), parseKeystroke('ctrl+s')],
      action: 'act',
      context: 'G',
    };
    expect(matchesBinding('k', emptyKey({ ctrl: true }), binding)).toBe(false);
  });

  it('单键和弦按单键匹配走', () => {
    const binding = {
      chord: [parseKeystroke('ctrl+k')],
      action: 'act',
      context: 'G',
    };
    expect(matchesBinding('k', emptyKey({ ctrl: true }), binding)).toBe(true);
  });
});
