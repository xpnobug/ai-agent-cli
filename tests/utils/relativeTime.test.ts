import { describe, it, expect } from 'vitest';
import {
  formatRelativeTime,
  formatRelativeTimeAgo,
  formatResetTime,
  formatResetText,
  formatLogMetadata,
} from '../../src/utils/relativeTime.js';

describe('formatRelativeTime narrow', () => {
  const now = new Date('2026-04-18T12:00:00');

  it('过去 3 小时', () => {
    const d = new Date(now.getTime() - 3 * 3600_000);
    expect(formatRelativeTime(d, { now })).toBe('3h ago');
  });

  it('未来 5 分钟', () => {
    const d = new Date(now.getTime() + 5 * 60_000);
    expect(formatRelativeTime(d, { now })).toBe('in 5m');
  });

  it('刚才 (<1s)', () => {
    expect(formatRelativeTime(now, { now })).toBe('0s ago');
  });

  it('未来 <1s（diffInSeconds = 0 仍走 "0s ago" 分支）', () => {
    expect(formatRelativeTime(new Date(now.getTime() + 500), { now })).toBe('0s ago');
  });

  it('天 / 周 / 月 / 年单位', () => {
    expect(formatRelativeTime(new Date(now.getTime() - 86400_000), { now })).toBe('1d ago');
    expect(formatRelativeTime(new Date(now.getTime() - 604800_000), { now })).toBe('1w ago');
    expect(formatRelativeTime(new Date(now.getTime() - 2_592_000_000), { now })).toBe('1mo ago');
    expect(formatRelativeTime(new Date(now.getTime() - 31_536_000_000), { now })).toBe('1y ago');
  });
});

describe('formatRelativeTimeAgo', () => {
  const now = new Date('2026-04-18T12:00:00');

  it('过去时间强制 numeric:always（走 narrow 分支）', () => {
    const d = new Date(now.getTime() - 3 * 3600_000);
    expect(formatRelativeTimeAgo(d, { now })).toBe('3h ago');
  });

  it('未来时间走 formatRelativeTime', () => {
    const d = new Date(now.getTime() + 2 * 3600_000);
    expect(formatRelativeTimeAgo(d, { now })).toBe('in 2h');
  });
});

describe('formatResetTime', () => {
  it('undefined 返回 undefined', () => {
    expect(formatResetTime(undefined)).toBeUndefined();
    expect(formatResetTime(0)).toBeUndefined();
  });

  it('24h 内：只返回时间，AM/PM 小写无空格', () => {
    // 2h 后
    const ts = Math.floor(Date.now() / 1000) + 2 * 3600;
    const out = formatResetTime(ts);
    expect(out).toBeTruthy();
    expect(out!).toMatch(/^\d{1,2}(:\d{2})?(am|pm)$/);
  });

  it('24h+ 显示月日', () => {
    const ts = Math.floor(Date.now() / 1000) + 30 * 86400;
    const out = formatResetTime(ts);
    expect(out).toBeTruthy();
    // 应包含月份缩写（Jan/Feb/...）
    expect(out!).toMatch(/[A-Z][a-z]{2}/);
  });

  it('showTimezone=true 追加时区', () => {
    const ts = Math.floor(Date.now() / 1000) + 2 * 3600;
    const out = formatResetTime(ts, true);
    expect(out!).toContain('(');
    expect(out!).toContain(')');
  });
});

describe('formatResetText', () => {
  it('接受 ISO 字符串', () => {
    const iso = new Date(Date.now() + 2 * 3600_000).toISOString();
    const out = formatResetText(iso);
    expect(out).toMatch(/am|pm/);
  });
});

describe('formatLogMetadata', () => {
  const modified = new Date(Date.now() - 3 * 3600_000); // 3h ago

  it('仅 messageCount', () => {
    // style='short' 走 Intl 的 long 格式（"3 hours ago"），而非 narrow
    const s = formatLogMetadata({ modified, messageCount: 42 });
    expect(s).toContain('hours ago');
    expect(s).toContain('42 messages');
    expect(s).toContain(' · ');
  });

  it('有 fileSize 时使用文件大小替代消息数', () => {
    const s = formatLogMetadata({ modified, messageCount: 42, fileSize: 1536 });
    expect(s).toContain('1.5KB');
    expect(s).not.toContain('42 messages');
  });

  it('可选字段正确拼接', () => {
    const s = formatLogMetadata({
      modified,
      messageCount: 5,
      gitBranch: 'main',
      tag: 'ui-fix',
      agentSetting: 'assistant',
      prNumber: 123,
      prRepository: 'acme/repo',
    });
    expect(s).toContain('main');
    expect(s).toContain('#ui-fix');
    expect(s).toContain('@assistant');
    expect(s).toContain('acme/repo#123');
  });

  it('无 repository 时 PR 仅 #N', () => {
    const s = formatLogMetadata({ modified, messageCount: 1, prNumber: 99 });
    expect(s).toContain('#99');
  });
});
