import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  memoryAgeDays,
  memoryAge,
  memoryFreshnessText,
  memoryFreshnessNote,
} from '../../../src/services/memdir/memoryAge.js';

const DAY = 86_400_000;

afterEach(() => {
  vi.useRealTimers();
});

describe('memoryAgeDays', () => {
  it('今天 = 0', () => {
    vi.setSystemTime(new Date(2026, 3, 20, 12, 0));
    expect(memoryAgeDays(Date.now())).toBe(0);
  });

  it('昨天 = 1', () => {
    vi.setSystemTime(new Date(2026, 3, 20, 12, 0));
    expect(memoryAgeDays(Date.now() - DAY)).toBe(1);
  });

  it('未来时间 → 归零', () => {
    vi.setSystemTime(new Date(2026, 3, 20, 12, 0));
    expect(memoryAgeDays(Date.now() + DAY)).toBe(0);
  });
});

describe('memoryAge 中文', () => {
  it('0/1/N 天分别返回 "今天"/"昨天"/"N 天前"', () => {
    vi.setSystemTime(new Date(2026, 3, 20, 12, 0));
    expect(memoryAge(Date.now())).toBe('今天');
    expect(memoryAge(Date.now() - DAY)).toBe('昨天');
    expect(memoryAge(Date.now() - 7 * DAY)).toBe('7 天前');
  });
});

describe('memoryFreshnessText / memoryFreshnessNote', () => {
  it('≤1 天返回空串', () => {
    vi.setSystemTime(new Date(2026, 3, 20, 12, 0));
    expect(memoryFreshnessText(Date.now())).toBe('');
    expect(memoryFreshnessText(Date.now() - DAY)).toBe('');
    expect(memoryFreshnessNote(Date.now())).toBe('');
  });

  it('≥2 天包含天数与提示语', () => {
    vi.setSystemTime(new Date(2026, 3, 20, 12, 0));
    const text = memoryFreshnessText(Date.now() - 47 * DAY);
    expect(text).toContain('47 天');
    expect(text).toContain('过时');
    const note = memoryFreshnessNote(Date.now() - 47 * DAY);
    expect(note).toMatch(/<system-reminder>.*<\/system-reminder>/);
  });
});
