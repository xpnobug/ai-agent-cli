import { describe, it, expect } from 'vitest';
import { findTextObject } from '../../../src/ui/vim/textObjects.js';

describe('findTextObject - w (word)', () => {
  it('inner 选中当前词', () => {
    const text = 'hello world';
    const r = findTextObject(text, 2, 'w', true);
    expect(r).toEqual({ start: 0, end: 5 });
  });

  it('around 扩展到尾随空白', () => {
    const text = 'hello world';
    const r = findTextObject(text, 2, 'w', false);
    expect(r).toEqual({ start: 0, end: 6 });
  });

  it('光标在空白上，inner 选中连续空白', () => {
    const text = 'a   b';
    const r = findTextObject(text, 2, 'w', true);
    expect(r).toEqual({ start: 1, end: 4 });
  });

  it('光标在标点上，选中连续标点', () => {
    const text = 'foo === bar';
    const r = findTextObject(text, 5, 'w', true);
    expect(r).toEqual({ start: 4, end: 7 });
  });
});

describe('findTextObject - quote 对', () => {
  it('i" 选引号内部', () => {
    const text = 'say "hello" now';
    const r = findTextObject(text, 6, '"', true);
    expect(r).toEqual({ start: 5, end: 10 });
    expect(text.slice(r!.start, r!.end)).toBe('hello');
  });

  it('a" 包含引号本身', () => {
    const text = 'say "hello" now';
    const r = findTextObject(text, 6, '"', false);
    expect(r).toEqual({ start: 4, end: 11 });
    expect(text.slice(r!.start, r!.end)).toBe('"hello"');
  });

  it('单引号 / 反引号一致', () => {
    expect(findTextObject("x'abc'y", 3, "'", true)).toEqual({ start: 2, end: 5 });
    expect(findTextObject('x`abc`y', 3, '`', true)).toEqual({ start: 2, end: 5 });
  });

  it('光标不在任何引号对内 → null', () => {
    expect(findTextObject('no quotes here', 5, '"', true)).toBeNull();
  });
});

describe('findTextObject - bracket 对', () => {
  it('i( 选括号内部', () => {
    const text = 'fn(a, b) + 1';
    const r = findTextObject(text, 4, '(', true);
    expect(text.slice(r!.start, r!.end)).toBe('a, b');
  });

  it('a( 包含括号本身', () => {
    const text = 'fn(a, b) + 1';
    const r = findTextObject(text, 4, '(', false);
    expect(text.slice(r!.start, r!.end)).toBe('(a, b)');
  });

  it('嵌套括号：选最内层', () => {
    const text = 'fn(a, (b, c), d)';
    const r = findTextObject(text, 8, '(', true);
    expect(text.slice(r!.start, r!.end)).toBe('b, c');
  });

  it('花括号 / 方括号 / 角括号', () => {
    expect(findTextObject('{a}', 1, '{', true)).toEqual({ start: 1, end: 2 });
    expect(findTextObject('[x]', 1, '[', true)).toEqual({ start: 1, end: 2 });
    expect(findTextObject('<p>', 1, '<', true)).toEqual({ start: 1, end: 2 });
  });

  it('b/B 是 ( / { 的别名', () => {
    expect(findTextObject('(x)', 1, 'b', true)).toEqual({ start: 1, end: 2 });
    expect(findTextObject('{x}', 1, 'B', true)).toEqual({ start: 1, end: 2 });
  });

  it('无匹配括号 → null', () => {
    expect(findTextObject('abc', 1, '(', true)).toBeNull();
  });
});

describe('未知 objectType', () => {
  it('返回 null', () => {
    expect(findTextObject('hello', 2, 'z', true)).toBeNull();
  });
});
