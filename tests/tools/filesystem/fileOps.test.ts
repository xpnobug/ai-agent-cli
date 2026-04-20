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
    await runEdit(workdir, fp, 'bar', 'BAR');
    expect(fs.readFileSync(fp, 'utf-8')).toBe('foo BAR baz');
  });

  it('old == new 返回错误', async () => {
    const fp = path.join(workdir, 'e.txt');
    fs.writeFileSync(fp, 'foo');
    const r = await runEdit(workdir, fp, 'foo', 'foo');
    const content = typeof r === 'string' ? r : String((r as { content: unknown }).content);
    expect(content).toContain('不同');
  });

  it('多重匹配 + 未传 replaceAll 返回错误', async () => {
    const fp = path.join(workdir, 'e.txt');
    fs.writeFileSync(fp, 'x x x');
    const r = await runEdit(workdir, fp, 'x', 'y');
    const content = typeof r === 'string' ? r : String((r as { content: unknown }).content);
    expect(content).toContain('3 次');
  });

  it('replaceAll=true 替换全部', async () => {
    const fp = path.join(workdir, 'e.txt');
    fs.writeFileSync(fp, 'x x x');
    await runEdit(workdir, fp, 'x', 'y', true);
    expect(fs.readFileSync(fp, 'utf-8')).toBe('y y y');
  });

  it('成功后 uiContent 含 diff 摘要与行内容', async () => {
    const fp = path.join(workdir, 'm.txt');
    fs.writeFileSync(fp, 'line 1\nold line\nline 3\n');
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
    // \u201D = 弯右双引号
    const r = await runEdit(workdir, fp, '"hello\u201D', '"world"');
    const obj = r as { uiContent?: string };
    expect(obj.uiContent).toContain('弯引号已归一化匹配');
    expect(fs.readFileSync(fp, 'utf-8')).toContain('"world"');
  });

  it('文件弯引号、模型直引号 → 同样识别为弯引号差异', async () => {
    const fp = path.join(workdir, 'q2.ts');
    fs.writeFileSync(fp, 'const msg = \u201Chello\u201D;\n');
    const r = await runEdit(workdir, fp, '"hello"', '"world"');
    const obj = r as { uiContent?: string };
    expect(obj.uiContent).toContain('弯引号已归一化匹配');
  });

  it('精确匹配不显示归一化提示', async () => {
    const fp = path.join(workdir, 'q3.ts');
    fs.writeFileSync(fp, 'const msg = "hello";\n');
    const r = await runEdit(workdir, fp, '"hello"', '"ok"');
    const obj = r as { uiContent?: string };
    expect(obj.uiContent).not.toContain('归一化');
    expect(obj.uiContent).not.toContain('模糊匹配');
  });
});
