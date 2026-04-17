import { describe, it, expect } from 'vitest';
import { runCronCreate, runCronList, runCronDelete } from '../../../src/tools/system/cronTool.js';

describe('runCronCreate 校验', () => {
  it('缺 cron → 错误', async () => {
    const r = await runCronCreate({ prompt: 'x' });
    expect(r).toContain('cron');
  });

  it('缺 prompt → 错误', async () => {
    const r = await runCronCreate({ cron: '* * * * *' });
    expect(r).toContain('prompt');
  });

  it('非法 cron 表达式 → 错误', async () => {
    const r = await runCronCreate({ cron: 'abc def', prompt: 'x' });
    expect(r).toContain('无法解析');
  });

  it('合法 cron 表达式 + 非 durable → 返回 id（会话级）', async () => {
    const r = await runCronCreate({ cron: '*/5 * * * *', prompt: '测试任务' });
    expect(r).toMatch(/"id":/);
    expect(r).toMatch(/session|仅当前会话/);
  });
});

describe('runCronList / runCronDelete', () => {
  it('list 返回字符串（可能为空）', async () => {
    const r = await runCronList();
    expect(typeof r).toBe('string');
  });

  it('delete 无 id → 错误', async () => {
    const r = await runCronDelete({});
    expect(r).toContain('至少');
  });

  it('create → list → delete 往返', async () => {
    const createRaw = await runCronCreate({ cron: '0 9 * * *', prompt: '晨报' });
    const created = JSON.parse(createRaw) as { id: string };
    expect(created.id).toBeTruthy();

    const listed = await runCronList();
    expect(listed).toContain(created.id);

    const del = await runCronDelete({ id: created.id });
    expect(del).toContain('已删除');
  });
});
