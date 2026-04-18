import { describe, it, expect } from 'vitest';
import { buildMemoryInjection } from '../../../src/services/memdir/inject.js';
import type { MemoryRecord } from '../../../src/services/memdir/memoryScan.js';

function mk(partial: Partial<MemoryRecord>): MemoryRecord {
  return {
    filePath: '/mem/x.md',
    fileName: 'x.md',
    name: 'default',
    description: '',
    body: '',
    type: undefined,
    mtimeMs: Date.now(),
    ...partial,
  };
}

describe('buildMemoryInjection', () => {
  it('没有任何记忆 → null', async () => {
    const r = await buildMemoryInjection('python 怎么写', { preloaded: [] });
    expect(r.systemReminderBlock).toBeNull();
    expect(r.hitCount).toBe(0);
  });

  it('无相关记忆 → null', async () => {
    const r = await buildMemoryInjection('kubernetes', {
      preloaded: [mk({ name: 'a', body: '毫不相关' })],
    });
    expect(r.systemReminderBlock).toBeNull();
  });

  it('命中 → <system-reminder> 包裹', async () => {
    const r = await buildMemoryInjection('python 数据分析', {
      preloaded: [
        mk({
          name: 'python-skill',
          description: '用户熟悉 python',
          body: '用户是数据科学家，常用 pandas 和 python',
          type: 'user',
          mtimeMs: Date.now(),
        }),
      ],
      minScore: 1,
    });
    expect(r.systemReminderBlock).toMatch(/<system-reminder>[\s\S]*<\/system-reminder>/);
    expect(r.systemReminderBlock).toContain('python-skill');
    expect(r.systemReminderBlock).toContain('[user]');
    expect(r.hitCount).toBe(1);
  });

  it('limit 截断', async () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      mk({ name: `m${i}`, body: 'docker' }),
    );
    const r = await buildMemoryInjection('docker', {
      preloaded: many,
      limit: 3,
      minScore: 1,
    });
    expect(r.hitCount).toBe(3);
  });

  it('正文超长截断到 200 字符', async () => {
    const long = 'x'.repeat(500);
    const r = await buildMemoryInjection('target', {
      preloaded: [mk({ name: 'long', description: 'target', body: long })],
      minScore: 1,
    });
    expect(r.systemReminderBlock).toContain('…');
    expect(r.systemReminderBlock!.length).toBeLessThan(600);
  });

  it('年龄标签随时间变化', async () => {
    const now = Date.now();
    const r = await buildMemoryInjection('react', {
      preloaded: [
        mk({
          name: 'today',
          description: 'react 用 functional',
          body: '',
          mtimeMs: now,
        }),
      ],
      now,
      minScore: 1,
    });
    expect(r.systemReminderBlock).toContain('今天');
  });
});
