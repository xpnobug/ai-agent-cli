import { describe, it, expect } from 'vitest';
import {
  parseKeystroke,
  parseChord,
  keystrokeToString,
  chordToString,
  keystrokeToDisplayString,
  chordToDisplayString,
  parseBindings,
} from '../../../src/ui/keybindings/parser.js';

describe('parseKeystroke', () => {
  it('单字符', () => {
    const ks = parseKeystroke('a');
    expect(ks).toMatchObject({ key: 'a', ctrl: false, alt: false, shift: false, meta: false, super: false });
  });

  it('ctrl+k', () => {
    expect(parseKeystroke('ctrl+k')).toMatchObject({ key: 'k', ctrl: true });
  });

  it('control 别名', () => {
    expect(parseKeystroke('control+k').ctrl).toBe(true);
  });

  it('alt/opt/option 都映射 alt', () => {
    expect(parseKeystroke('alt+a').alt).toBe(true);
    expect(parseKeystroke('opt+a').alt).toBe(true);
    expect(parseKeystroke('option+a').alt).toBe(true);
  });

  it('cmd/command/super/win 都映射 super', () => {
    expect(parseKeystroke('cmd+a').super).toBe(true);
    expect(parseKeystroke('command+a').super).toBe(true);
    expect(parseKeystroke('super+a').super).toBe(true);
    expect(parseKeystroke('win+a').super).toBe(true);
  });

  it('多修饰键组合 ctrl+shift+k', () => {
    const ks = parseKeystroke('ctrl+shift+k');
    expect(ks).toMatchObject({ key: 'k', ctrl: true, shift: true });
  });

  it('特殊键别名', () => {
    expect(parseKeystroke('esc').key).toBe('escape');
    expect(parseKeystroke('return').key).toBe('enter');
    expect(parseKeystroke('space').key).toBe(' ');
    expect(parseKeystroke('↑').key).toBe('up');
    expect(parseKeystroke('↓').key).toBe('down');
    expect(parseKeystroke('←').key).toBe('left');
    expect(parseKeystroke('→').key).toBe('right');
  });

  it('大小写不敏感', () => {
    const ks = parseKeystroke('CTRL+K');
    expect(ks).toMatchObject({ ctrl: true, key: 'k' });
  });
});

describe('parseChord', () => {
  it('单独一个空格字符 = space 键绑定', () => {
    const c = parseChord(' ');
    expect(c).toHaveLength(1);
    expect(c[0]?.key).toBe(' ');
  });

  it('用空白分隔多个键击', () => {
    const c = parseChord('ctrl+k ctrl+s');
    expect(c).toHaveLength(2);
    expect(c[0]).toMatchObject({ ctrl: true, key: 'k' });
    expect(c[1]).toMatchObject({ ctrl: true, key: 's' });
  });

  it('多空白分隔', () => {
    expect(parseChord('a   b   c')).toHaveLength(3);
  });

  it('首尾空白被 trim', () => {
    expect(parseChord('  a  ')).toHaveLength(1);
  });
});

describe('keystrokeToString / chordToString', () => {
  it('修饰键按固定顺序 ctrl alt shift meta cmd', () => {
    const ks = parseKeystroke('shift+alt+ctrl+meta+cmd+k');
    expect(keystrokeToString(ks)).toBe('ctrl+alt+shift+meta+cmd+k');
  });

  it('特殊键显示名', () => {
    expect(keystrokeToString(parseKeystroke('esc'))).toBe('Esc');
    expect(keystrokeToString(parseKeystroke('up'))).toBe('↑');
    expect(keystrokeToString(parseKeystroke('space'))).toBe('Space');
  });

  it('chordToString 空格连接', () => {
    expect(chordToString(parseChord('ctrl+k ctrl+s'))).toBe('ctrl+k ctrl+s');
  });
});

describe('keystrokeToDisplayString', () => {
  const ks = parseKeystroke('alt+cmd+k');

  it('linux 下 alt/super', () => {
    expect(keystrokeToDisplayString(ks, 'linux')).toBe('alt+super+k');
  });

  it('macos 下 opt/cmd', () => {
    expect(keystrokeToDisplayString(ks, 'macos')).toBe('opt+cmd+k');
  });

  it('默认 linux', () => {
    expect(keystrokeToDisplayString(ks)).toBe('alt+super+k');
  });

  it('chordToDisplayString 支持多键', () => {
    expect(chordToDisplayString(parseChord('ctrl+k ctrl+s'), 'macos')).toBe('ctrl+k ctrl+s');
  });
});

describe('parseBindings', () => {
  it('展平多个 context 块', () => {
    const bindings = parseBindings([
      { context: 'Global', bindings: { 'ctrl+k': 'app:clear', 'ctrl+q': 'app:quit' } },
      { context: 'Input', bindings: { 'enter': 'input:submit' } },
    ]);
    expect(bindings).toHaveLength(3);
    expect(bindings[0]).toMatchObject({ action: 'app:clear', context: 'Global' });
    expect(bindings[2]).toMatchObject({ action: 'input:submit', context: 'Input' });
  });

  it('null 值（解绑）保留在 action 里', () => {
    const bindings = parseBindings([{ context: 'G', bindings: { 'ctrl+k': null } }]);
    expect(bindings[0]?.action).toBeNull();
  });
});
