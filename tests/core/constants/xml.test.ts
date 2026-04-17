import { describe, it, expect } from 'vitest';
import {
  BASH_STDOUT_TAG,
  LOCAL_COMMAND_STDOUT_TAG,
  TERMINAL_OUTPUT_TAGS,
  TICK_TAG,
  TASK_NOTIFICATION_TAG,
  COMMON_HELP_ARGS,
  COMMON_INFO_ARGS,
  isWrappedInTag,
  isTerminalOutput,
  isHelpArg,
  isInfoArg,
} from '../../../src/core/constants/xml.js';

describe('标签常量', () => {
  it('TICK_TAG 固定值', () => {
    expect(TICK_TAG).toBe('tick');
  });
  it('TASK_NOTIFICATION_TAG 固定值', () => {
    expect(TASK_NOTIFICATION_TAG).toBe('task-notification');
  });
  it('TERMINAL_OUTPUT_TAGS 包含常见终端标签', () => {
    expect(TERMINAL_OUTPUT_TAGS).toContain(BASH_STDOUT_TAG);
    expect(TERMINAL_OUTPUT_TAGS).toContain(LOCAL_COMMAND_STDOUT_TAG);
  });
  it('HELP / INFO 参数列表非空', () => {
    expect(COMMON_HELP_ARGS.length).toBeGreaterThan(0);
    expect(COMMON_INFO_ARGS.length).toBeGreaterThan(0);
  });
});

describe('isWrappedInTag', () => {
  it('精确匹配整段包裹', () => {
    expect(isWrappedInTag('<bash-stdout>ok</bash-stdout>', 'bash-stdout')).toBe(true);
  });
  it('空白 trim 后再判断', () => {
    expect(isWrappedInTag('  <bash-stdout>ok</bash-stdout>  ', 'bash-stdout')).toBe(true);
  });
  it('未包裹 → false', () => {
    expect(isWrappedInTag('hello', 'bash-stdout')).toBe(false);
  });
});

describe('isTerminalOutput', () => {
  it('识别任一终端标签', () => {
    expect(isTerminalOutput('<bash-stdout>x</bash-stdout>')).toBe(true);
    expect(isTerminalOutput('<local-command-stderr>y</local-command-stderr>')).toBe(true);
  });
  it('普通消息 → false', () => {
    expect(isTerminalOutput('请帮我修 bug')).toBe(false);
  });
});

describe('isHelpArg / isInfoArg', () => {
  it('大小写不敏感', () => {
    expect(isHelpArg('HELP')).toBe(true);
    expect(isHelpArg('--HELP')).toBe(true);
    expect(isInfoArg('Status')).toBe(true);
  });
  it('undefined → false', () => {
    expect(isHelpArg(undefined)).toBe(false);
    expect(isInfoArg(undefined)).toBe(false);
  });
  it('未知参数 → false', () => {
    expect(isHelpArg('do')).toBe(false);
    expect(isInfoArg('do')).toBe(false);
  });
});
