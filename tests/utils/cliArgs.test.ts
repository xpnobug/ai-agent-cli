import { describe, it, expect } from 'vitest';
import {
  eagerParseCliFlag,
  extractArgsAfterDoubleDash,
} from '../../src/utils/cliArgs.js';

describe('eagerParseCliFlag', () => {
  it('--flag value 语法', () => {
    const argv = ['node', 'cli', '--settings', 'path.json'];
    expect(eagerParseCliFlag('--settings', argv)).toBe('path.json');
  });
  it('--flag=value 语法', () => {
    const argv = ['node', 'cli', '--settings=path.json'];
    expect(eagerParseCliFlag('--settings', argv)).toBe('path.json');
  });
  it('未指定返回 undefined', () => {
    const argv = ['node', 'cli', '--other'];
    expect(eagerParseCliFlag('--settings', argv)).toBeUndefined();
  });
  it('flag 是末尾且无值 → undefined', () => {
    const argv = ['node', 'cli', '--settings'];
    expect(eagerParseCliFlag('--settings', argv)).toBeUndefined();
  });
  it('取第一次出现的 flag', () => {
    const argv = ['node', 'cli', '--settings', 'a', '--settings', 'b'];
    expect(eagerParseCliFlag('--settings', argv)).toBe('a');
  });
});

describe('extractArgsAfterDoubleDash', () => {
  it('positional 是 -- → 从 args 取第一个作为 command', () => {
    expect(extractArgsAfterDoubleDash('--', ['sub', '--flag', 'x'])).toEqual({
      command: 'sub',
      args: ['--flag', 'x'],
    });
  });
  it('positional 非 -- → 原样返回', () => {
    expect(extractArgsAfterDoubleDash('run', ['foo'])).toEqual({
      command: 'run',
      args: ['foo'],
    });
  });
  it('-- 但 args 为空 → 原样返回', () => {
    expect(extractArgsAfterDoubleDash('--', [])).toEqual({
      command: '--',
      args: [],
    });
  });
});
