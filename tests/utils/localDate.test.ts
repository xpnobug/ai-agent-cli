import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getLocalISODate,
  getSessionStartDate,
  getLocalMonthYear,
  _resetSessionStartDateForTest,
} from '../../src/utils/localDate.js';

describe('getLocalISODate', () => {
  beforeEach(() => _resetSessionStartDateForTest());

  it('格式 YYYY-MM-DD', () => {
    expect(getLocalISODate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('尊重 AI_AGENT_OVERRIDE_DATE', () => {
    process.env.AI_AGENT_OVERRIDE_DATE = '2020-01-02';
    try {
      expect(getLocalISODate()).toBe('2020-01-02');
    } finally {
      delete process.env.AI_AGENT_OVERRIDE_DATE;
    }
  });

  it('兼容 CLAUDE_CODE_OVERRIDE_DATE', () => {
    process.env.CLAUDE_CODE_OVERRIDE_DATE = '1999-12-31';
    try {
      expect(getLocalISODate()).toBe('1999-12-31');
    } finally {
      delete process.env.CLAUDE_CODE_OVERRIDE_DATE;
    }
  });
});

describe('getSessionStartDate 缓存', () => {
  beforeEach(() => _resetSessionStartDateForTest());
  afterEach(() => _resetSessionStartDateForTest());

  it('多次调用返回同一值', () => {
    const a = getSessionStartDate();
    const b = getSessionStartDate();
    expect(a).toBe(b);
  });

  it('首次算出后即便环境变量改变也不刷新', () => {
    process.env.AI_AGENT_OVERRIDE_DATE = '2021-01-01';
    try {
      const first = getSessionStartDate();
      process.env.AI_AGENT_OVERRIDE_DATE = '2099-12-31';
      expect(getSessionStartDate()).toBe(first);
    } finally {
      delete process.env.AI_AGENT_OVERRIDE_DATE;
    }
  });
});

describe('getLocalMonthYear', () => {
  it('格式为 "Month YYYY"', () => {
    expect(getLocalMonthYear()).toMatch(/^[A-Za-z]+ \d{4}$/);
  });

  it('override 后按 override 月/年显示', () => {
    process.env.AI_AGENT_OVERRIDE_DATE = '2020-02-15';
    try {
      expect(getLocalMonthYear()).toBe('February 2020');
    } finally {
      delete process.env.AI_AGENT_OVERRIDE_DATE;
    }
  });
});
