import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runNotebookEdit } from '../../../src/tools/filesystem/notebook.js';

let workdir = '';

function setup(): void {
  workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'aac-nb-'));
}

function teardown(): void {
  if (workdir && fs.existsSync(workdir)) fs.rmSync(workdir, { recursive: true, force: true });
  workdir = '';
}

function writeNotebook(cells: unknown[]): string {
  const nb = {
    cells,
    metadata: { kernelspec: { name: 'python3' } },
    nbformat: 4,
    nbformat_minor: 5,
  };
  const fp = path.join(workdir, 'nb.ipynb');
  fs.writeFileSync(fp, JSON.stringify(nb, null, 2), 'utf-8');
  return fp;
}

function readNotebook(fp: string): { cells: Array<{ cell_type: string; source: string[]; id?: string }> } {
  return JSON.parse(fs.readFileSync(fp, 'utf-8'));
}

describe('runNotebookEdit 输入校验', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('非绝对路径 → 错误', async () => {
    const r = await runNotebookEdit({ notebook_path: 'rel.ipynb' });
    expect(r).toContain('绝对路径');
  });

  it('非 .ipynb 扩展名 → 错误', async () => {
    const r = await runNotebookEdit({ notebook_path: path.join(workdir, 'a.txt') });
    expect(r).toContain('.ipynb');
  });

  it('文件不存在 → 错误', async () => {
    const r = await runNotebookEdit({ notebook_path: path.join(workdir, 'none.ipynb') });
    expect(r).toContain('不存在');
  });

  it('坏 JSON → 错误', async () => {
    const fp = path.join(workdir, 'bad.ipynb');
    fs.writeFileSync(fp, '{ broken', 'utf-8');
    const r = await runNotebookEdit({ notebook_path: fp });
    expect(r).toContain('解析');
  });
});

describe('runNotebookEdit replace', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('替换 cell 源码', async () => {
    const fp = writeNotebook([
      { cell_type: 'code', source: ['print(1)\n'], metadata: {}, outputs: [], execution_count: null },
      { cell_type: 'code', source: ['print(2)\n'], metadata: {}, outputs: [], execution_count: null },
    ]);
    const r = await runNotebookEdit({ notebook_path: fp, cell_number: 0, new_source: 'print("hi")' });
    expect(r).toContain('replace');
    const nb = readNotebook(fp);
    expect(nb.cells[0]?.source).toEqual(['print("hi")']);
  });

  it('索引越界 → 错误', async () => {
    const fp = writeNotebook([{ cell_type: 'code', source: [''] }]);
    const r = await runNotebookEdit({ notebook_path: fp, cell_number: 99, new_source: 'x' });
    expect(r).toContain('越界');
  });

  it('同时切换 cell_type', async () => {
    const fp = writeNotebook([
      { cell_type: 'code', source: ['x'], metadata: {}, outputs: [], execution_count: null },
    ]);
    await runNotebookEdit({ notebook_path: fp, cell_number: 0, cell_type: 'markdown', new_source: '# title' });
    const nb = readNotebook(fp);
    expect(nb.cells[0]?.cell_type).toBe('markdown');
  });
});

describe('runNotebookEdit insert', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('缺 cell_type → 错误', async () => {
    const fp = writeNotebook([]);
    const r = await runNotebookEdit({ notebook_path: fp, edit_mode: 'insert', new_source: 'x' });
    expect(r).toContain('cell_type');
  });

  it('在指定位置插入', async () => {
    const fp = writeNotebook([
      { cell_type: 'code', source: ['a'], metadata: {}, outputs: [], execution_count: null },
      { cell_type: 'code', source: ['c'], metadata: {}, outputs: [], execution_count: null },
    ]);
    await runNotebookEdit({
      notebook_path: fp,
      edit_mode: 'insert',
      cell_number: 1,
      cell_type: 'code',
      new_source: 'b',
    });
    const nb = readNotebook(fp);
    expect(nb.cells.map((c) => c.source.join(''))).toEqual(['a', 'b', 'c']);
  });

  it('不给 cell_number 则追加到末尾', async () => {
    const fp = writeNotebook([
      { cell_type: 'code', source: ['a'], metadata: {}, outputs: [], execution_count: null },
    ]);
    await runNotebookEdit({
      notebook_path: fp,
      edit_mode: 'insert',
      cell_type: 'markdown',
      new_source: '# end',
    });
    const nb = readNotebook(fp);
    expect(nb.cells).toHaveLength(2);
    expect(nb.cells[1]?.cell_type).toBe('markdown');
  });
});

describe('runNotebookEdit delete', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('按 cell_number 删除', async () => {
    const fp = writeNotebook([
      { cell_type: 'code', source: ['a'], metadata: {}, outputs: [], execution_count: null },
      { cell_type: 'code', source: ['b'], metadata: {}, outputs: [], execution_count: null },
    ]);
    await runNotebookEdit({ notebook_path: fp, edit_mode: 'delete', cell_number: 0 });
    const nb = readNotebook(fp);
    expect(nb.cells).toHaveLength(1);
    expect(nb.cells[0]?.source).toEqual(['b']);
  });

  it('按 cell_id 删除', async () => {
    const fp = writeNotebook([
      { cell_type: 'code', source: ['a'], id: 'aaa', metadata: {}, outputs: [], execution_count: null },
      { cell_type: 'code', source: ['b'], id: 'bbb', metadata: {}, outputs: [], execution_count: null },
    ]);
    await runNotebookEdit({ notebook_path: fp, edit_mode: 'delete', cell_id: 'bbb' });
    const nb = readNotebook(fp);
    expect(nb.cells).toHaveLength(1);
    expect(nb.cells[0]?.id).toBe('aaa');
  });
});
