import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runRead, runWrite, runEdit } from '../../../src/tools/filesystem/fileOps.js';

let workdir = '';

function setup(): void {
  workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'aac-fs-'));
  // fileHistory 写入 $HOME/.ai-agent/fileHistory/，隔离到 workdir 下
  process.env.HOME = workdir;
}

function teardown(): void {
  if (workdir && fs.existsSync(workdir)) {
    fs.rmSync(workdir, { recursive: true, force: true });
  }
  workdir = '';
}

describe('runWrite', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('创建新文件', async () => {
    const fp = path.join(workdir, 'hello.txt');
    const r = await runWrite(workdir, fp, 'hello world');
    expect(r).toBeTruthy();
    expect(fs.readFileSync(fp, 'utf-8')).toBe('hello world');
  });

  it('非绝对路径返回错误', async () => {
    const r = await runWrite(workdir, 'rel.txt', 'x');
    const content = typeof r === 'string' ? r : JSON.stringify(r);
    expect(content).toContain('绝对路径');
  });
});

describe('runRead', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('读取已存在文件', async () => {
    const fp = path.join(workdir, 'a.txt');
    fs.writeFileSync(fp, 'line1\nline2\n');
    const r = await runRead(workdir, fp);
    const content = typeof r === 'string' ? r : String((r as { content: unknown }).content);
    expect(content).toContain('line1');
    expect(content).toContain('line2');
  });

  it('不存在文件返回错误', async () => {
    const fp = path.join(workdir, 'nope.txt');
    const r = await runRead(workdir, fp);
    const content = typeof r === 'string' ? r : String((r as { content: unknown }).content);
    expect(content).toContain('不存在');
  });

  it('目录路径返回错误', async () => {
    const r = await runRead(workdir, workdir);
    const content = typeof r === 'string' ? r : String((r as { content: unknown }).content);
    expect(content).toContain('目录');
  });
});

describe('runEdit', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('精确替换', async () => {
    const fp = path.join(workdir, 'e.txt');
    fs.writeFileSync(fp, 'foo bar baz');
    await runRead(workdir, fp);
    await runEdit(workdir, fp, 'bar', 'BAR');
    expect(fs.readFileSync(fp, 'utf-8')).toBe('foo BAR baz');
  });

  it('old == new 返回错误', async () => {
    const fp = path.join(workdir, 'e.txt');
    fs.writeFileSync(fp, 'foo');
    await runRead(workdir, fp);
    const r = await runEdit(workdir, fp, 'foo', 'foo');
    const content = typeof r === 'string' ? r : String((r as { content: unknown }).content);
    expect(content).toContain('不同');
  });

  it('多重匹配 + 未传 replaceAll 返回错误', async () => {
    const fp = path.join(workdir, 'e.txt');
    fs.writeFileSync(fp, 'x x x');
    await runRead(workdir, fp);
    const r = await runEdit(workdir, fp, 'x', 'y');
    const content = typeof r === 'string' ? r : String((r as { content: unknown }).content);
    expect(content).toContain('3 次');
  });

  it('replaceAll=true 替换全部', async () => {
    const fp = path.join(workdir, 'e.txt');
    fs.writeFileSync(fp, 'x x x');
    await runRead(workdir, fp);
    await runEdit(workdir, fp, 'x', 'y', true);
    expect(fs.readFileSync(fp, 'utf-8')).toBe('y y y');
  });

  it('成功后 uiContent 含 diff 摘要与行内容', async () => {
    const fp = path.join(workdir, 'm.txt');
    fs.writeFileSync(fp, 'line 1\nold line\nline 3\n');
    await runRead(workdir, fp);
    const r = await runEdit(workdir, fp, 'old line', 'new line');
    const obj = r as { uiContent?: string };
    expect(obj.uiContent).toBeDefined();
    expect(obj.uiContent!).toMatch(/Edited .*\(\d+ hunk/);
    expect(obj.uiContent!).toContain('─── ');
    expect(obj.uiContent!).toContain('+++ ');
    expect(obj.uiContent!).toContain('old line');
    expect(obj.uiContent!).toContain('new line');
  });

  it('模型发弯引号、文件直引号 → 成功 + 显示归一化提示', async () => {
    const fp = path.join(workdir, 'q.ts');
    fs.writeFileSync(fp, 'const msg = "hello";\n');
    await runRead(workdir, fp);
    // \u201D = 弯右双引号
    const r = await runEdit(workdir, fp, '"hello\u201D', '"world"');
    const obj = r as { uiContent?: string };
    expect(obj.uiContent).toContain('弯引号已归一化匹配');
    expect(fs.readFileSync(fp, 'utf-8')).toContain('"world"');
  });

  it('文件弯引号、模型直引号 → 同样识别为弯引号差异', async () => {
    const fp = path.join(workdir, 'q2.ts');
    fs.writeFileSync(fp, 'const msg = \u201Chello\u201D;\n');
    await runRead(workdir, fp);
    const r = await runEdit(workdir, fp, '"hello"', '"world"');
    const obj = r as { uiContent?: string };
    expect(obj.uiContent).toContain('弯引号已归一化匹配');
  });

  it('精确匹配不显示归一化提示', async () => {
    const fp = path.join(workdir, 'q3.ts');
    fs.writeFileSync(fp, 'const msg = "hello";\n');
    await runRead(workdir, fp);
    const r = await runEdit(workdir, fp, '"hello"', '"ok"');
    const obj = r as { uiContent?: string };
    expect(obj.uiContent).not.toContain('归一化');
    expect(obj.uiContent).not.toContain('模糊匹配');
  });
});

describe('文件新鲜度检查', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('Edit 未读先改 → 拒绝', async () => {
    const fp = path.join(workdir, 'a.txt');
    fs.writeFileSync(fp, 'foo bar');
    const r = await runEdit(workdir, fp, 'foo', 'FOO');
    const content = typeof r === 'string' ? r : String((r as { content: unknown }).content);
    expect(content).toContain('未被读取');
  });

  it('Write 覆盖已存在文件但未读 → 拒绝', async () => {
    const fp = path.join(workdir, 'a.txt');
    fs.writeFileSync(fp, 'old');
    const r = await runWrite(workdir, fp, 'new');
    const content = typeof r === 'string' ? r : String((r as { content: unknown }).content);
    expect(content).toContain('未被读取');
  });

  it('Write 创建新文件无需先读', async () => {
    const fp = path.join(workdir, 'fresh.txt');
    const r = await runWrite(workdir, fp, 'hello');
    // 新建文件不应返回错误
    expect(fs.readFileSync(fp, 'utf-8')).toBe('hello');
    expect(r).toBeTruthy();
  });

  it('读过后再改 → 允许', async () => {
    const fp = path.join(workdir, 'b.txt');
    fs.writeFileSync(fp, 'foo');
    await runRead(workdir, fp);
    await runEdit(workdir, fp, 'foo', 'FOO');
    expect(fs.readFileSync(fp, 'utf-8')).toBe('FOO');
  });

  it('读过后文件被外部改动 → 拒绝', async () => {
    const fp = path.join(workdir, 'c.txt');
    fs.writeFileSync(fp, 'v1');
    await runRead(workdir, fp);
    // 模拟外部改动：等 mtime 精度、再覆盖
    await new Promise((r) => setTimeout(r, 10));
    fs.writeFileSync(fp, 'v2 (external)');
    const r = await runEdit(workdir, fp, 'v2', 'v3');
    const content = typeof r === 'string' ? r : String((r as { content: unknown }).content);
    expect(content).toContain('外部修改');
  });

  it('Edit 成功后同一轮内可继续 Edit（mtime 自动更新）', async () => {
    const fp = path.join(workdir, 'd.txt');
    fs.writeFileSync(fp, 'a\nb\nc\n');
    await runRead(workdir, fp);
    await runEdit(workdir, fp, 'a', 'A');
    // 第二次 edit 不应被新鲜度检查拒（内部已更新 timestamp）
    await runEdit(workdir, fp, 'b', 'B');
    expect(fs.readFileSync(fp, 'utf-8')).toBe('A\nB\nc\n');
  });
});
