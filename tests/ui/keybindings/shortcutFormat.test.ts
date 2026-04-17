import { describe, it, expect } from 'vitest';
import { parseBindings } from '../../../src/ui/keybindings/parser.js';
import { getShortcutDisplay } from '../../../src/ui/keybindings/shortcutFormat.js';

const bindings = parseBindings([
  {
    context: 'Global',
    bindings: { 'ctrl+o': 'app:toggleTranscript' },
  },
]);

describe('getShortcutDisplay', () => {
  it('命中 → 返回绑定的 chord 字符串', () => {
    expect(getShortcutDisplay('app:toggleTranscript', 'Global', 'fallback', bindings))
      .toBe('ctrl+o');
  });

  it('未命中 → 返回 fallback', () => {
    expect(getShortcutDisplay('nope', 'Global', 'ctrl+x', bindings)).toBe('ctrl+x');
  });

  it('context 不匹配也走 fallback', () => {
    expect(getShortcutDisplay('app:toggleTranscript', 'OtherCtx', 'f', bindings))
      .toBe('f');
  });
});
