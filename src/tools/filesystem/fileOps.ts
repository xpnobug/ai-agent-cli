/**
 * 文件操作工具 - read_file, write_file, edit_file
 */

import fs from 'fs-extra';
import path from 'node:path';
import { safePath } from '../../services/system/security.js';
import { validateFileAccess } from '../../services/system/sensitiveFiles.js';
import { getFileReadTimestamp, recordFileRead } from '../../services/system/fileFreshness.js';

const MAX_OUTPUT_SIZE = 0.25 * 1024 * 1024; // 0.25MB
const MAX_LINE_LENGTH = 2000;

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

function formatFileSizeError(sizeInBytes: number): string {
  const sizeKB = Math.round(sizeInBytes / 1024);
  const limitKB = Math.round(MAX_OUTPUT_SIZE / 1024);
  return `错误: 文件内容 (${sizeKB}KB) 超过最大允许输出 (${limitKB}KB)。请使用 offset/limit 读取局部内容。`;
}

function clampLine(line: string): string {
  return line.length > MAX_LINE_LENGTH ? line.slice(0, MAX_LINE_LENGTH) : line;
}

function sliceLines(
  lines: string[],
  offset?: number,
  limit?: number
): { startLine: number; sliced: string[]; totalLines: number } {
  const startLine = offset && offset > 0 ? offset : 1;
  const startIndex = Math.max(startLine - 1, 0);
  const totalLines = lines.length;
  const sliced = limit && limit > 0
    ? lines.slice(startIndex, startIndex + limit)
    : lines.slice(startIndex);
  return { startLine, sliced, totalLines };
}

/**
 * 读取文件
 */
export async function runRead(
  workdir: string,
  filePath: string,
  limit?: number,
  offset?: number
): Promise<string> {
  try {
    // 安全路径检查
    const fullPath = safePath(workdir, filePath);

    // 检查文件是否存在
    if (!(await fs.pathExists(fullPath))) {
      return `错误: 文件不存在: ${filePath}`;
    }

    // 检查是否为目录
    const stats = await fs.stat(fullPath);
    if (stats.isDirectory()) {
      return `错误: ${filePath} 是一个目录，请使用 bash ls 命令查看目录内容`;
    }

    const ext = path.extname(fullPath).toLowerCase();

    if (BINARY_EXTENSIONS.has(ext)) {
      return `错误: 无法读取二进制文件 (${ext})，请使用合适的工具进行分析。`;
    }

    if (IMAGE_EXTENSIONS.has(ext)) {
      if (stats.size === 0) {
        return '错误: 空图片无法处理。';
      }
      recordFileRead(fullPath, stats.mtimeMs);
      return 'Read image';
    }

    if (ext === '.pdf') {
      if (stats.size === 0) {
        return '错误: 空 PDF 文件无法处理。';
      }
      recordFileRead(fullPath, stats.mtimeMs);
      return 'Read pdf';
    }

    if (stats.size > MAX_OUTPUT_SIZE && !offset && !limit) {
      return formatFileSizeError(stats.size);
    }

    // 读取文件内容
    const content = await fs.readFile(fullPath, 'utf-8');

    // 记录读取时间戳
    recordFileRead(fullPath, stats.mtimeMs);

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
        const allLines = extracted.split(/\r?\n/);
        const { sliced } = sliceLines(allLines, offset, limit);
        const processed = sliced.map(clampLine).join('\n');
        if (Buffer.byteLength(processed, 'utf8') > MAX_OUTPUT_SIZE) {
          return formatFileSizeError(Buffer.byteLength(processed, 'utf8'));
        }
        return processed;
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return `错误: 无法解析 notebook 文件: ${msg}`;
      }
    }

    // 按行分割
    const allLines = content.split(/\r?\n/);
    const { sliced } = sliceLines(allLines, offset, limit);
    const processed = sliced.map(clampLine).join('\n');

    if (Buffer.byteLength(processed, 'utf8') > MAX_OUTPUT_SIZE) {
      return formatFileSizeError(Buffer.byteLength(processed, 'utf8'));
    }

    return processed;
  } catch (error: unknown) {
    if (error instanceof Error) {
      return `错误: ${error.message}`;
    }
    return `错误: ${String(error)}`;
  }
}

/**
 * 写入文件
 */
export async function runWrite(
  workdir: string,
  filePath: string,
  content: string
): Promise<string> {
  try {
    // 敏感文件保护
    validateFileAccess(workdir, filePath, 'write');

    // 安全路径检查
    const fullPath = safePath(workdir, filePath);

    const exists = await fs.pathExists(fullPath);
    if (exists) {
      const readTimestamp = getFileReadTimestamp(fullPath);
      if (!readTimestamp) {
        return '错误: 文件尚未读取，请先使用 read_file 读取后再写入。';
      }
      const stats = await fs.stat(fullPath);
      if (stats.mtimeMs > readTimestamp) {
        return '错误: 文件在读取后已被修改，请重新读取后再写入。';
      }
    }

    // 确保父目录存在
    await fs.ensureDir(path.dirname(fullPath));

    // 写入文件
    await fs.writeFile(fullPath, content, 'utf-8');

    // 获取文件大小
    const stats = await fs.stat(fullPath);
    const sizeKB = (stats.size / 1024).toFixed(2);

    recordFileRead(fullPath, stats.mtimeMs);

    return `成功写入文件: ${filePath} (${sizeKB} KB, ${content.split('\n').length} 行)`;
  } catch (error: unknown) {
    if (error instanceof Error) {
      return `错误: ${error.message}`;
    }
    return `错误: ${String(error)}`;
  }
}

/**
 * 编辑文件
 */
export async function runEdit(
  workdir: string,
  filePath: string,
  oldText: string,
  newText: string,
  replaceAll: boolean = false
): Promise<string> {
  try {
    // 敏感文件保护
    validateFileAccess(workdir, filePath, 'edit');

    // 安全路径检查
    const fullPath = safePath(workdir, filePath);

    // 检查文件是否存在
    if (!(await fs.pathExists(fullPath))) {
      return `错误: 文件不存在: ${filePath}`;
    }

    const readTimestamp = getFileReadTimestamp(fullPath);
    if (!readTimestamp) {
      return '错误: 文件尚未读取，请先使用 read_file 读取后再编辑。';
    }
    const stats = await fs.stat(fullPath);
    if (stats.mtimeMs > readTimestamp) {
      return '错误: 文件在读取后已被修改，请重新读取后再编辑。';
    }

    // 读取文件内容
    const content = await fs.readFile(fullPath, 'utf-8');

    // 检查 old_text 是否存在
    if (!content.includes(oldText)) {
      return `错误: 在文件中未找到要替换的文本。请确保 old_text 精确匹配。\n文件前100字符: ${content.slice(0, 100)}...`;
    }

    // 计算匹配次数
    const matches = content.split(oldText).length - 1;

    if (matches > 1 && !replaceAll) {
      return `错误: old_text 在文件中出现 ${matches} 次。请提供更具体的文本以确保唯一匹配，或使用 replace_all 参数替换所有匹配。`;
    }

    // 替换文本
    const newContent = replaceAll
      ? content.replaceAll(oldText, newText)
      : content.replace(oldText, newText);

    // 写回文件
    await fs.writeFile(fullPath, newContent, 'utf-8');

    // 计算变化
    const oldLines = oldText.split('\n').length;
    const newLines = newText.split('\n').length;
    const lineDiff = newLines - oldLines;

    const updatedStats = await fs.stat(fullPath);
    recordFileRead(fullPath, updatedStats.mtimeMs);

    return `成功编辑文件: ${filePath}
替换了 ${oldLines} 行，新增 ${lineDiff > 0 ? '+' : ''}${lineDiff} 行
文件现在共 ${newContent.split('\n').length} 行`;
  } catch (error: unknown) {
    if (error instanceof Error) {
      return `错误: ${error.message}`;
    }
    return `错误: ${String(error)}`;
  }
}
