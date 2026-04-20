/**
 * 文件操作工具 - read_file, write_file, edit_file
 */

import fs from 'fs-extra';
import path from 'node:path';
import type { ToolExecutionResult, ToolResultContentBlock } from '../../core/types.js';
import { getPatchFromContents, renderHunksForUI, summarizeHunks } from '../../utils/diff.js';
import {
  recordFileRead,
  getFileReadTimestamp,
} from '../../services/system/fileFreshness.js';

const MAX_OUTPUT_SIZE = 0.25 * 1024 * 1024; // 0.25MB
const MAX_LINE_LENGTH = 2000;
const MAX_IMAGE_SIZE = 3.75 * 1024 * 1024; // 3.75MB
const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_READ_LIMIT = 2000;
const MIN_LINE_NUMBER_WIDTH = 6;
const DIFF_CONTEXT = 3;
const MAX_TOOL_RESULT_CHARS = 100000;
const MAX_FIELD_CHARS = 40000;
const MIN_FIELD_CHARS = 10000;
const CLIPPED_NOTE = '<response clipped><NOTE>To save on context only part of this file has been shown to you. You should retry this tool after you have searched inside the file with Grep in order to find the line numbers of what you are looking for.</NOTE>';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);

const BINARY_EXTENSIONS = new Set([
  '.mp3',
  '.wav',
  '.flac',
  '.ogg',
  '.aac',
  '.m4a',
  '.wma',
  '.aiff',
  '.opus',
  '.mp4',
  '.avi',
  '.mov',
  '.wmv',
  '.flv',
  '.mkv',
  '.webm',
  '.m4v',
  '.mpeg',
  '.mpg',
  '.zip',
  '.rar',
  '.tar',
  '.gz',
  '.bz2',
  '.7z',
  '.xz',
  '.z',
  '.tgz',
  '.iso',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.app',
  '.msi',
  '.deb',
  '.rpm',
  '.bin',
  '.dat',
  '.db',
  '.sqlite',
  '.sqlite3',
  '.mdb',
  '.idx',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.odt',
  '.ods',
  '.odp',
  '.ttf',
  '.otf',
  '.woff',
  '.woff2',
  '.eot',
  '.psd',
  '.ai',
  '.eps',
  '.sketch',
  '.fig',
  '.xd',
  '.blend',
  '.obj',
  '.3ds',
  '.max',
  '.class',
  '.jar',
  '.war',
  '.pyc',
  '.pyo',
  '.rlib',
  '.swf',
  '.fla',
]);

type StructuredPatchHunk = {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
};

type GitDiff = {
  filename: string;
  status: 'modified' | 'added';
  additions: number;
  deletions: number;
  changes: number;
  patch: string;
};

type FileWriteResult = {
  type: 'create' | 'update';
  filePath: string;
  content: string;
  structuredPatch: StructuredPatchHunk[];
  originalFile: string | null;
  gitDiff?: GitDiff;
};

type FileEditResult = {
  filePath: string;
  oldString: string;
  newString: string;
  originalFile: string;
  structuredPatch: StructuredPatchHunk[];
  userModified: boolean;
  replaceAll: boolean;
  gitDiff?: GitDiff;
};

type DiffOp = {
  type: 'equal' | 'insert' | 'delete';
  line: string;
};

function formatFileSizeError(sizeInBytes: number): string {
  const sizeKB = Math.round(sizeInBytes / 1024);
  const limitKB = Math.round(MAX_OUTPUT_SIZE / 1024);
  return `错误: 文件内容 (${sizeKB}KB) 超过最大允许输出 (${limitKB}KB)。请使用 offset/limit 读取局部内容。`;
}

function clampLine(line: string): string {
  return line.length > MAX_LINE_LENGTH ? line.slice(0, MAX_LINE_LENGTH) : line;
}

function buildError(message: string): ToolExecutionResult {
  return {
    content: message,
    uiContent: message,
    isError: true,
  };
}

function splitLines(text: string): string[] {
  if (!text) return [];
  return text.split(/\r?\n/);
}

function sliceLines(
  lines: string[],
  offset?: number,
  limit?: number
): { startLine: number; sliced: string[]; totalLines: number } {
  const startLine = typeof offset === 'number' && offset > 0 ? Math.floor(offset) : 1;
  const startIndex = Math.max(startLine - 1, 0);
  const totalLines = lines.length;
  const effectiveLimit = typeof limit === 'number' ? Math.floor(limit) : DEFAULT_READ_LIMIT;
  const sliced = effectiveLimit > 0
    ? lines.slice(startIndex, startIndex + effectiveLimit)
    : lines.slice(startIndex);
  return { startLine, sliced, totalLines };
}

function formatLineNumberPrefix(lineNumber: number, width: number): string {
  return `${String(lineNumber).padStart(width, ' ')}\t`;
}

function addLineNumbers(lines: string[], startLine: number): string {
  if (lines.length === 0) return '';
  const endLine = startLine + lines.length - 1;
  const width = Math.max(MIN_LINE_NUMBER_WIDTH, String(endLine).length);
  return lines
    .map((line, index) => `${formatLineNumberPrefix(startLine + index, width)}${line}`)
    .join('\n');
}

function clipText(value: string, limit: number): string {
  if (value.length <= limit) return value;
  const sliceLength = Math.max(0, limit - CLIPPED_NOTE.length);
  return `${value.slice(0, sliceLength)}${CLIPPED_NOTE}`;
}

function ensureResultSize<T extends FileWriteResult | FileEditResult>(result: T): T {
  const initialSize = JSON.stringify(result).length;
  if (initialSize <= MAX_TOOL_RESULT_CHARS) return result;

  const noPatch = { ...result, structuredPatch: [] as StructuredPatchHunk[] } as T;
  if (JSON.stringify(noPatch).length <= MAX_TOOL_RESULT_CHARS) return noPatch;

  const hasContent = 'content' in result;
  const clipped = {
    ...noPatch,
    ...(hasContent ? { content: clipText((result as FileWriteResult).content, MAX_FIELD_CHARS) } : {}),
    originalFile: result.originalFile
      ? clipText(result.originalFile, MAX_FIELD_CHARS)
      : result.originalFile,
  } as T;
  if (JSON.stringify(clipped).length <= MAX_TOOL_RESULT_CHARS) return clipped;

  const tighter = {
    ...clipped,
    ...(hasContent ? { content: clipText((result as FileWriteResult).content, MIN_FIELD_CHARS) } : {}),
    originalFile: result.originalFile
      ? clipText(result.originalFile, MIN_FIELD_CHARS)
      : result.originalFile,
  } as T;

  if (JSON.stringify(tighter).length <= MAX_TOOL_RESULT_CHARS) return tighter;

  const noGitDiff = { ...tighter, gitDiff: undefined } as T;
  return noGitDiff;
}

function buildDiffOps(oldLines: string[], newLines: string[]): DiffOp[] {
  if (oldLines.length === 0 && newLines.length === 0) return [];
  if (oldLines.length === 0) return newLines.map((line) => ({ type: 'insert', line }));
  if (newLines.length === 0) return oldLines.map((line) => ({ type: 'delete', line }));

  const max = oldLines.length + newLines.length;
  let v = new Map<number, number>();
  v.set(1, 0);
  const trace: Array<Map<number, number>> = [];

  for (let d = 0; d <= max; d += 1) {
    const vNew = new Map<number, number>();
    for (let k = -d; k <= d; k += 2) {
      let x: number;
      const vKMinus = v.get(k - 1) ?? 0;
      const vKPlus = v.get(k + 1) ?? 0;
      if (k === -d || (k !== d && vKMinus < vKPlus)) {
        x = vKPlus;
      } else {
        x = vKMinus + 1;
      }
      let y = x - k;
      while (x < oldLines.length && y < newLines.length && oldLines[x] === newLines[y]) {
        x += 1;
        y += 1;
      }
      vNew.set(k, x);
      if (x >= oldLines.length && y >= newLines.length) {
        trace.push(vNew);
        return backtrackDiff(trace, oldLines, newLines);
      }
    }
    trace.push(vNew);
    v = vNew;
  }

  return backtrackDiff(trace, oldLines, newLines);
}

function backtrackDiff(
  trace: Array<Map<number, number>>,
  oldLines: string[],
  newLines: string[]
): DiffOp[] {
  let x = oldLines.length;
  let y = newLines.length;
  const ops: DiffOp[] = [];

  for (let d = trace.length - 1; d >= 0; d -= 1) {
    const v = trace[d];
    const k = x - y;
    let prevK: number;
    const vKMinus = v.get(k - 1) ?? 0;
    const vKPlus = v.get(k + 1) ?? 0;

    if (k === -d || (k !== d && vKMinus < vKPlus)) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }

    const prevX = v.get(prevK) ?? 0;
    const prevY = prevX - prevK;

    while (x > prevX && y > prevY) {
      ops.push({ type: 'equal', line: oldLines[x - 1] });
      x -= 1;
      y -= 1;
    }

    if (d === 0) break;

    if (x === prevX) {
      ops.push({ type: 'insert', line: newLines[y - 1] });
      y -= 1;
    } else {
      ops.push({ type: 'delete', line: oldLines[x - 1] });
      x -= 1;
    }
  }

  return ops.reverse();
}

function buildStructuredPatch(oldLines: string[], newLines: string[]): StructuredPatchHunk[] {
  if (oldLines.length === newLines.length && oldLines.every((line, index) => line === newLines[index])) {
    return [];
  }

  const ops = buildDiffOps(oldLines, newLines);
  const hunks: StructuredPatchHunk[] = [];
  let hunk: StructuredPatchHunk | null = null;
  let preContext: Array<{ line: string; oldLine: number; newLine: number }> = [];
  let equalRun: Array<{ line: string; oldLine: number; newLine: number }> = [];
  let oldLineNo = 1;
  let newLineNo = 1;

  for (const op of ops) {
    if (op.type === 'equal') {
      const info = { line: op.line, oldLine: oldLineNo, newLine: newLineNo };
      if (hunk) {
        hunk.lines.push(` ${op.line}`);
        hunk.oldLines += 1;
        hunk.newLines += 1;
        equalRun.push(info);

        if (equalRun.length > DIFF_CONTEXT * 2) {
          const removeCount = equalRun.length - DIFF_CONTEXT;
          hunk.lines.splice(hunk.lines.length - removeCount, removeCount);
          hunk.oldLines -= removeCount;
          hunk.newLines -= removeCount;
          hunks.push(hunk);
          preContext = equalRun.slice(-DIFF_CONTEXT);
          hunk = null;
          equalRun = [];
        }
      } else {
        preContext.push(info);
        if (preContext.length > DIFF_CONTEXT) preContext.shift();
      }

      oldLineNo += 1;
      newLineNo += 1;
      continue;
    }

    if (!hunk) {
      const startOld = preContext.length > 0 ? preContext[0].oldLine : oldLineNo;
      const startNew = preContext.length > 0 ? preContext[0].newLine : newLineNo;
      hunk = {
        oldStart: startOld,
        newStart: startNew,
        oldLines: 0,
        newLines: 0,
        lines: [],
      };
      for (const ctx of preContext) {
        hunk.lines.push(` ${ctx.line}`);
        hunk.oldLines += 1;
        hunk.newLines += 1;
      }
    }

    preContext = [];
    equalRun = [];

    if (op.type === 'delete') {
      hunk.lines.push(`-${op.line}`);
      hunk.oldLines += 1;
      oldLineNo += 1;
    } else {
      hunk.lines.push(`+${op.line}`);
      hunk.newLines += 1;
      newLineNo += 1;
    }
  }

  if (hunk) hunks.push(hunk);
  return hunks;
}

function buildWriteResult(
  filePath: string,
  originalFile: string | null,
  content: string
): FileWriteResult {
  const oldLines = splitLines(originalFile ?? '');
  const newLines = splitLines(content);
  const structuredPatch = buildStructuredPatch(oldLines, newLines);
  const gitDiff = buildGitDiff(
    filePath,
    originalFile === null ? 'added' : 'modified',
    structuredPatch,
    originalFile === null
  );

  const result: FileWriteResult = {
    type: originalFile === null ? 'create' : 'update',
    filePath,
    content,
    structuredPatch,
    originalFile,
    gitDiff,
  };

  return ensureResultSize(result);
}

function buildEditResult(
  filePath: string,
  oldString: string,
  newString: string,
  originalFile: string,
  replaceAll: boolean,
  updatedFile: string
): FileEditResult {
  // 走 diff npm 包的 structuredPatch（和 renderHunksForUI 保持一致）
  // 替代原本地实现 buildStructuredPatch，其对修改行的定位有 bug
  const structuredPatch = getPatchFromContents({
    filePath,
    oldContent: originalFile,
    newContent: updatedFile,
  });
  const gitDiff = buildGitDiff(filePath, 'modified', structuredPatch, false);

  const result: FileEditResult = {
    filePath,
    oldString,
    newString,
    originalFile,
    structuredPatch,
    userModified: false,
    replaceAll,
    gitDiff,
  };

  return ensureResultSize(result);
}

function buildGitDiff(
  filePath: string,
  status: 'modified' | 'added',
  structuredPatch: StructuredPatchHunk[],
  isNewFile: boolean
): GitDiff | undefined {
  const additions = structuredPatch.reduce(
    (count, hunk) => count + hunk.lines.filter((line) => line.startsWith('+')).length,
    0
  );
  const deletions = structuredPatch.reduce(
    (count, hunk) => count + hunk.lines.filter((line) => line.startsWith('-')).length,
    0
  );
  const changes = additions + deletions;

  if (structuredPatch.length === 0) {
    return {
      filename: filePath,
      status,
      additions,
      deletions,
      changes,
      patch: '',
    };
  }

  const header: string[] = [];
  header.push(`diff --git a/${filePath} b/${filePath}`);

  if (status === 'added') {
    header.push('new file mode 100644');
    header.push('--- /dev/null');
    header.push(`+++ b/${filePath}`);
  } else {
    header.push(`--- a/${filePath}`);
    header.push(`+++ b/${filePath}`);
  }

  for (const hunk of structuredPatch) {
    const oldStart = isNewFile ? 0 : hunk.oldStart;
    const oldLines = isNewFile ? 0 : hunk.oldLines;
    const oldRange = `${oldStart},${oldLines}`;
    const newRange = `${hunk.newStart},${hunk.newLines}`;
    header.push(`@@ -${oldRange} +${newRange} @@`);
    header.push(...hunk.lines);
  }

  let patch = header.join('\n');
  if (patch.length > MAX_FIELD_CHARS) {
    patch = clipText(patch, MAX_FIELD_CHARS);
  }

  return {
    filename: filePath,
    status,
    additions,
    deletions,
    changes,
    patch,
  };
}

/**
 * 读取文件
 */
export async function runRead(
  workdir: string,
  filePath: string,
  limit?: number,
  offset?: number
): Promise<ToolExecutionResult> {
  try {
    if (!path.isAbsolute(filePath)) {
      return buildError('错误: file_path 必须是绝对路径。');
    }

    const fullPath = path.resolve(workdir, filePath);

    if (!(await fs.pathExists(fullPath))) {
      return buildError(`错误: 文件不存在: ${filePath}`);
    }

    const stats = await fs.stat(fullPath);
    if (stats.isDirectory()) {
      return buildError(`错误: ${filePath} 是一个目录，请使用 bash ls 命令查看目录内容`);
    }

    // 记录本次读取时的 mtime，供后续 Edit/Write 做新鲜度检测
    recordFileRead(fullPath, stats.mtimeMs);

    const ext = path.extname(fullPath).toLowerCase();

    if (BINARY_EXTENSIONS.has(ext)) {
      return buildError(`错误: 无法读取二进制文件 (${ext})，请使用合适的工具进行分析。`);
    }

    if (IMAGE_EXTENSIONS.has(ext)) {
      if (stats.size === 0) {
        return buildError('错误: 空图片无法处理。');
      }
      if (stats.size > MAX_IMAGE_SIZE) {
        return buildError('错误: 图片大小超过限制，请缩小图片后再读取。');
      }
      const buffer = await fs.readFile(fullPath);
      const mediaType = ext === '.jpg' || ext === '.jpeg'
        ? 'image/jpeg'
        : ext === '.png'
          ? 'image/png'
          : ext === '.gif'
            ? 'image/gif'
            : 'image/webp';
      const block: ToolResultContentBlock = {
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType,
          data: buffer.toString('base64'),
        },
      };
      return {
        content: [block],
        uiContent: 'Read image',
      };
    }

    if (ext === '.pdf') {
      if (stats.size === 0) {
        return buildError('错误: 空 PDF 文件无法处理。');
      }
      if (stats.size > MAX_PDF_SIZE) {
        return buildError('错误: PDF 文件过大，请缩小文件后再读取。');
      }
      const buffer = await fs.readFile(fullPath);
      const block: ToolResultContentBlock = {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: buffer.toString('base64'),
        },
      };
      return {
        content: [block],
        uiContent: 'Read pdf',
      };
    }

    const content = await fs.readFile(fullPath, 'utf-8');

    if (ext === '.ipynb') {
      try {
        const notebook = JSON.parse(content);
        const cells: Array<{ cell_type?: string; source?: string[] | string }> =
          Array.isArray(notebook?.cells) ? notebook.cells : [];
        const sources: string[] = [];
        for (const cell of cells) {
          if (cell.cell_type !== 'code') continue;
          if (Array.isArray(cell.source)) {
            sources.push(cell.source.join(''));
          } else if (typeof cell.source === 'string') {
            sources.push(cell.source);
          }
        }
        const extracted = sources.join('\n');
        const allLines = splitLines(extracted);
        const { startLine, sliced } = sliceLines(allLines, offset, limit);
        const processedLines = sliced.map(clampLine);
        const numbered = addLineNumbers(processedLines, startLine);
        if (Buffer.byteLength(numbered, 'utf8') > MAX_OUTPUT_SIZE) {
          return buildError(formatFileSizeError(Buffer.byteLength(numbered, 'utf8')));
        }
        return {
          content: numbered,
          uiContent: numbered,
        };
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return buildError(`错误: 无法解析 notebook 文件: ${msg}`);
      }
    }

    const allLines = splitLines(content);
    const { startLine, sliced } = sliceLines(allLines, offset, limit);
    const processedLines = sliced.map(clampLine);
    const numbered = addLineNumbers(processedLines, startLine);

    if (Buffer.byteLength(numbered, 'utf8') > MAX_OUTPUT_SIZE) {
      return buildError(formatFileSizeError(Buffer.byteLength(numbered, 'utf8')));
    }

    return {
      content: numbered,
      uiContent: numbered,
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      return buildError(`错误: ${error.message}`);
    }
    return buildError(`错误: ${String(error)}`);
  }
}

/**
 * 新鲜度检查：确保写入/编辑前已读取且内容未被外部改动。
 *
 * 返回 null 表示通过；返回字符串表示要拒绝的错误消息。
 */
async function checkFileFreshness(fullPath: string): Promise<string | null> {
  if (!(await fs.pathExists(fullPath))) return null; // 新建文件，无需检查
  try {
    const stats = await fs.stat(fullPath);
    if (!stats.isFile()) return null; // 非文件路径（如 socket），交给后续逻辑处理
    const last = getFileReadTimestamp(fullPath);
    if (last === null) {
      return `错误: 文件 ${fullPath} 在修改前未被读取。请先用 read_file 读取内容，避免覆盖当前磁盘状态。`;
    }
    // 允许 2ms 容差（某些文件系统 mtime 精度 1ms，某些为 2ms）
    if (stats.mtimeMs - last > 2) {
      const lastIso = new Date(last).toISOString();
      const currIso = new Date(stats.mtimeMs).toISOString();
      return (
        `错误: 文件 ${fullPath} 自上次读取后被外部修改。\n` +
        `  上次读取: ${lastIso}\n` +
        `  当前 mtime: ${currIso}\n` +
        `请重新 read_file 获取最新内容后再编辑，避免覆盖他人改动。`
      );
    }
  } catch {
    // stat 失败不阻塞；交给后续读写路径抛更具体的错
  }
  return null;
}

/**
 * 写入文件
 */
export async function runWrite(
  workdir: string,
  filePath: string,
  content: string
): Promise<ToolExecutionResult> {
  try {
    if (!path.isAbsolute(filePath)) {
      return buildError('错误: file_path 必须是绝对路径。');
    }

    const fullPath = path.resolve(workdir, filePath);

    // 新鲜度检查：已存在的文件必须先读过且未被外部改动
    const fresh = await checkFileFreshness(fullPath);
    if (fresh) return buildError(fresh);

    const exists = await fs.pathExists(fullPath);
    const originalFile = exists ? await fs.readFile(fullPath, 'utf-8') : null;

    await fs.ensureDir(path.dirname(fullPath));

    // 覆盖已有文件前备份
    if (exists) {
      const { backupFileBeforeEdit, createSnapshot } = await import('../../utils/fileHistory.js');
      const backup = backupFileBeforeEdit(fullPath);
      if (backup) createSnapshot([backup]);
    }

    await fs.writeFile(fullPath, content, 'utf-8');

    // 更新新鲜度记录：本次写入后的 mtime 视为已读状态
    try {
      const st = await fs.stat(fullPath);
      recordFileRead(fullPath, st.mtimeMs);
    } catch {
      // 更新失败不影响主流程
    }

    const result = buildWriteResult(filePath, originalFile, content);

    return {
      content: JSON.stringify(result),
      uiContent: `${result.type === 'create' ? 'Created' : 'Updated'} ${filePath}`,
      rawOutput: result,
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      return buildError(`错误: ${error.message}`);
    }
    return buildError(`错误: ${String(error)}`);
  }
}

/**
 * 编辑文件
 */
export async function runEdit(
  workdir: string,
  filePath: string,
  oldString: string,
  newString: string,
  replaceAll: boolean = false
): Promise<ToolExecutionResult> {
  try {
    if (!path.isAbsolute(filePath)) {
      return buildError('错误: file_path 必须是绝对路径。');
    }

    if (oldString === newString) {
      return buildError('错误: new_string 必须与 old_string 不同。');
    }

    const fullPath = path.resolve(workdir, filePath);

    if (!(await fs.pathExists(fullPath))) {
      return buildError(`错误: 文件不存在: ${filePath}`);
    }

    // 新鲜度检查：必须先读且未被外部改动
    const fresh = await checkFileFreshness(fullPath);
    if (fresh) return buildError(fresh);

    const content = await fs.readFile(fullPath, 'utf-8');

    // 模糊匹配：先精确匹配，失败后尝试引号归一化 + 尾部空白归一化
    const { findActualString, normalizeQuotes, stripTrailingWhitespace } = await import('../../utils/editUtils.js');
    const actualString = findActualString(content, oldString);

    if (!actualString) {
      return buildError(`错误: 在文件中未找到要替换的文本。请确保 old_string 精确匹配。\n文件前100字符: ${content.slice(0, 100)}...`);
    }

    // 识别 fuzzy 匹配原因，用作 UI 诊断提示
    const fuzzyReasons: string[] = [];
    if (actualString !== oldString) {
      // 归一化后相等 ⇒ 引号差异是唯一变量
      if (normalizeQuotes(actualString) === normalizeQuotes(oldString)) {
        fuzzyReasons.push('弯引号已归一化匹配');
      } else if (
        stripTrailingWhitespace(actualString) ===
        stripTrailingWhitespace(oldString)
      ) {
        fuzzyReasons.push('尾部空白差异已忽略');
      } else {
        fuzzyReasons.push('已做模糊匹配');
      }
    }

    // 使用实际匹配到的字符串进行替换（可能是弯引号版本）
    const effectiveOld = actualString;
    const matches = content.split(effectiveOld).length - 1;
    if (matches > 1 && !replaceAll) {
      return buildError(`错误: old_string 在文件中出现 ${matches} 次。请提供更具体的文本以确保唯一匹配，或使用 replace_all 参数替换所有匹配。`);
    }

    const updated = replaceAll
      ? content.replaceAll(effectiveOld, newString)
      : content.replace(effectiveOld, newString);

    // 编辑前备份（用于撤销）
    const { backupFileBeforeEdit, createSnapshot } = await import('../../utils/fileHistory.js');
    const backup = backupFileBeforeEdit(fullPath);
    if (backup) createSnapshot([backup]);

    await fs.writeFile(fullPath, updated, 'utf-8');

    // 更新新鲜度记录：本次编辑后的 mtime 作为新的"已读"基准，
    // 同一轮内继续编辑同文件不会误报
    try {
      const st = await fs.stat(fullPath);
      recordFileRead(fullPath, st.mtimeMs);
    } catch {
      // 更新失败不影响主流程
    }

    const result = buildEditResult(
      filePath,
      oldString,
      newString,
      content,
      replaceAll,
      updated
    );

    const diffBlock = renderHunksForUI(result.structuredPatch);
    const summary = summarizeHunks(result.structuredPatch);
    const header = `Edited ${filePath}${summary ? `  (${summary})` : ''}`;
    const notice = fuzzyReasons.length > 0 ? `\nℹ  ${fuzzyReasons.join('；')}\n` : '';
    const uiContent = diffBlock ? `${header}${notice}\n${diffBlock}` : `${header}${notice}`;

    return {
      content: JSON.stringify(result),
      uiContent,
      rawOutput: result,
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      return buildError(`错误: ${error.message}`);
    }
    return buildError(`错误: ${String(error)}`);
  }
}
