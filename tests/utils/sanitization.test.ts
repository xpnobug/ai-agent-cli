import { describe, it, expect } from 'vitest';
import {
  partiallySanitizeUnicode,
  recursivelySanitizeUnicode,
} from '../../src/utils/sanitization.js';

describe('partiallySanitizeUnicode', () => {
  it('正常文本原样', () => {
    expect(partiallySanitizeUnicode('hello world')).toBe('hello world');
    expect(partiallySanitizeUnicode('你好')).toBe('你好');
  });

  it('去除零宽空格', () => {
    const hidden = 'hello\u200Bworld';
    expect(partiallySanitizeUnicode(hidden)).toBe('helloworld');
  });

  it('去除字节序标记 BOM', () => {
    expect(partiallySanitizeUnicode('\uFEFFok')).toBe('ok');
  });

  it('去除方向覆盖字符（RLO/LRO）', () => {
    // U+202E RIGHT-TO-LEFT OVERRIDE
    expect(partiallySanitizeUnicode('abc\u202Edef')).toBe('abcdef');
  });

  it('去除方向隔离字符（LRI/RLI/FSI/PDI）', () => {
    expect(partiallySanitizeUnicode('a\u2066b\u2067c\u2068d\u2069e')).toBe(
      'abcde',
    );
  });

  it('去除私用区字符', () => {
    expect(partiallySanitizeUnicode('a\uE000b\uF8FFc')).toBe('abc');
  });

  it('NFKC 规范化：兼容分解合并', () => {
    // 全角 A 在 NFKC 下会被规范化为普通 A
    const out = partiallySanitizeUnicode('\uFF21');
    expect(out).toBe('A');
  });

  it('多种混合同时去除', () => {
    const nasty = 'user:\u200B admin\u202E!';
    expect(partiallySanitizeUnicode(nasty)).toBe('user: admin!');
  });

  it('空串原样', () => {
    expect(partiallySanitizeUnicode('')).toBe('');
  });
});

describe('recursivelySanitizeUnicode', () => {
  it('字符串直接走 partial', () => {
    expect(recursivelySanitizeUnicode('a\u200Bb')).toBe('ab');
  });

  it('数组逐项处理', () => {
    expect(recursivelySanitizeUnicode(['a\u200Bb', 'c'])).toEqual(['ab', 'c']);
  });

  it('对象 key 与 value 都处理', () => {
    const out = recursivelySanitizeUnicode({
      'k\u200Bey': 'v\u200Balue',
    });
    expect(out).toEqual({ key: 'value' });
  });

  it('嵌套对象递归', () => {
    const input = {
      name: 'ali\u200Bce',
      tags: ['a\uFEFF', 'b'],
      meta: { nested: 'x\u202Dy' },
    };
    const out = recursivelySanitizeUnicode(input);
    expect(out).toEqual({
      name: 'alice',
      tags: ['a', 'b'],
      meta: { nested: 'xy' },
    });
  });

  it('基本类型（数字、布尔、null）原样', () => {
    expect(recursivelySanitizeUnicode(42)).toBe(42);
    expect(recursivelySanitizeUnicode(true)).toBe(true);
    expect(recursivelySanitizeUnicode(null)).toBe(null);
  });
});
