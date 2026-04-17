/**
 * NotebookEditTool — 编辑 Jupyter .ipynb 单元格
 *
 * 对照源：claude-code-sourcemap/src/tools/NotebookEditTool
 * 支持三种模式：replace / insert / delete，目标以 0-based cell_number 或 cell_id 定位。
 */

import fs from 'fs-extra';
import path from 'node:path';

export type NotebookEditMode = 'replace' | 'insert' | 'delete';

interface NotebookCell {
  cell_type: 'code' | 'markdown' | string;
  id?: string;
  source: string | string[];
  metadata?: Record<string, unknown>;
  outputs?: unknown[];
  execution_count?: number | null;
}

interface Notebook {
  cells: NotebookCell[];
  metadata?: Record<string, unknown>;
  nbformat?: number;
  nbformat_minor?: number;
}

export interface NotebookEditInput {
  notebook_path?: string;
  cell_number?: number;
  cell_id?: string;
  cell_type?: 'code' | 'markdown';
  edit_mode?: NotebookEditMode;
  new_source?: string;
}

function splitSource(source: string): string[] {
  if (source === '') return [];
  const lines = source.split('\n');
  // Jupyter 惯例：每行保留尾随 \n，最后一行不带
  return lines.map((line, i) => (i < lines.length - 1 ? line + '\n' : line));
}

function findCellIndex(
  nb: Notebook,
  cellNumber?: number,
  cellId?: string,
): number {
  if (typeof cellNumber === 'number' && Number.isInteger(cellNumber)) {
    return cellNumber;
  }
  if (cellId) {
    return nb.cells.findIndex((c) => c.id === cellId);
  }
  return -1;
}

export async function runNotebookEdit(input: NotebookEditInput): Promise<string> {
  const filePath = input.notebook_path;
  if (!filePath || !path.isAbsolute(filePath)) {
    return '错误: notebook_path 必须为绝对路径';
  }
  if (!filePath.toLowerCase().endsWith('.ipynb')) {
    return '错误: 仅支持 .ipynb 文件';
  }
  if (!(await fs.pathExists(filePath))) {
    return `错误: 文件不存在: ${filePath}`;
  }

  let nb: Notebook;
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    nb = JSON.parse(raw) as Notebook;
    if (!Array.isArray(nb.cells)) throw new Error('notebook 缺少 cells 数组');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `错误: 无法解析 .ipynb: ${msg}`;
  }

  const mode: NotebookEditMode = input.edit_mode ?? 'replace';
  const newSource = typeof input.new_source === 'string' ? input.new_source : '';
  const sourceArray = splitSource(newSource);
  const idx = findCellIndex(nb, input.cell_number, input.cell_id);

  try {
    switch (mode) {
      case 'replace': {
        if (idx < 0 || idx >= nb.cells.length) {
          return `错误: cell index 越界（当前 ${nb.cells.length} 个单元格）`;
        }
        const target = nb.cells[idx]!;
        target.source = sourceArray;
        if (input.cell_type) target.cell_type = input.cell_type;
        break;
      }
      case 'insert': {
        if (!input.cell_type) {
          return '错误: 插入单元格必须提供 cell_type';
        }
        const insertAt = idx < 0 ? nb.cells.length : Math.max(0, Math.min(idx, nb.cells.length));
        const cell: NotebookCell = {
          cell_type: input.cell_type,
          source: sourceArray,
          metadata: {},
        };
        if (input.cell_type === 'code') {
          cell.outputs = [];
          cell.execution_count = null;
        }
        nb.cells.splice(insertAt, 0, cell);
        break;
      }
      case 'delete': {
        if (idx < 0 || idx >= nb.cells.length) {
          return `错误: cell index 越界（当前 ${nb.cells.length} 个单元格）`;
        }
        nb.cells.splice(idx, 1);
        break;
      }
      default:
        return `错误: 未知 edit_mode "${String(mode)}"，应为 replace/insert/delete`;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `错误: 编辑单元格失败: ${msg}`;
  }

  try {
    await fs.writeFile(filePath, JSON.stringify(nb, null, 2) + '\n', 'utf-8');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `错误: 写回 .ipynb 失败: ${msg}`;
  }

  return `已 ${mode} 单元格 ${idx < 0 ? '(append)' : `#${idx}`}，当前共 ${nb.cells.length} 个单元格`;
}
