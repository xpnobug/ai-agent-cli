import { describe, it, expect } from 'vitest';
import {
  EFFORT_LEVELS,
  isEffortLevel,
  isValidNumericEffort,
  parseEffortValue,
  convertEffortValueToLevel,
  toPersistableEffort,
} from '../../src/utils/effort.js';

describe('常量 / 类型守卫', () => {
  it('EFFORT_LEVELS 四个档', () => {
    expect(EFFORT_LEVELS).toEqual(['low', 'medium', 'high', 'max']);
  });
  it('isEffortLevel 只认四个固定字符串', () => {
    for (const lvl of EFFORT_LEVELS) expect(isEffortLevel(lvl)).toBe(true);
    expect(isEffortLevel('extra')).toBe(false);
    expect(isEffortLevel('LOW')).toBe(false);
  });
  it('isValidNumericEffort：只有整数才行', () => {
    expect(isValidNumericEffort(0)).toBe(true);
    expect(isValidNumericEffort(5)).toBe(true);
    expect(isValidNumericEffort(-1)).toBe(true);
    expect(isValidNumericEffort(1.5)).toBe(false);
    expect(isValidNumericEffort(NaN)).toBe(false);
  });
});

describe('parseEffortValue', () => {
  it('空值返回 undefined', () => {
    expect(parseEffortValue(undefined)).toBeUndefined();
    expect(parseEffortValue(null)).toBeUndefined();
    expect(parseEffortValue('')).toBeUndefined();
  });
  it('合法数字原样', () => {
    expect(parseEffortValue(3)).toBe(3);
    expect(parseEffortValue(0)).toBe(0);
  });
  it('等级字符串大小写无关', () => {
    expect(parseEffortValue('low')).toBe('low');
    expect(parseEffortValue('HIGH')).toBe('high');
  });
  it('可转整数字符串 → 数字', () => {
    expect(parseEffortValue('42')).toBe(42);
  });
  it('非法字符串 → undefined；非整数数字会被 parseInt 截断', () => {
    expect(parseEffortValue('banana')).toBeUndefined();
    // 1.2 不是整数，走 String 分支后 parseInt("1.2")=1 返回 1（与上游一致）
    expect(parseEffortValue(1.2)).toBe(1);
  });
});

describe('convertEffortValueToLevel', () => {
  it('字符串合法直通、非法 fallback high', () => {
    expect(convertEffortValueToLevel('medium')).toBe('medium');
    expect(convertEffortValueToLevel('bogus' as never)).toBe('high');
  });
  it('数字分档', () => {
    expect(convertEffortValueToLevel(0)).toBe('low');
    expect(convertEffortValueToLevel(1)).toBe('medium');
    expect(convertEffortValueToLevel(2)).toBe('medium');
    expect(convertEffortValueToLevel(3)).toBe('high');
    expect(convertEffortValueToLevel(100)).toBe('high');
  });
});

describe('toPersistableEffort', () => {
  it('只保留 low/medium/high', () => {
    expect(toPersistableEffort('low')).toBe('low');
    expect(toPersistableEffort('high')).toBe('high');
  });
  it('max / 数字 / undefined → undefined', () => {
    expect(toPersistableEffort('max')).toBeUndefined();
    expect(toPersistableEffort(3)).toBeUndefined();
    expect(toPersistableEffort(undefined)).toBeUndefined();
  });
});
