/**
 * 文件操作工具 - read_file, write_file, edit_file
 */

import fs from 'fs-extra';
import path from 'node:path';
import { safePath, truncateOutput } from '../../services/system/security.js';

const MAX_FILE_SIZE = 50 * 1024; // 50KB 限制（用于读取）

/**
 * 读取文件
 */
export async function runRead(
  workdir: string,
  filePath: string,
  limit?: number
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

    // 读取文件内容
    const content = await fs.readFile(fullPath, 'utf-8');

    // 按行分割
    const lines = content.split('\n');

    // 如果指定了行数限制
    if (limit && limit > 0) {
      const limitedLines = lines.slice(0, limit);
      const result = limitedLines
        .map((line, index) => `${index + 1}→${line}`)
        .join('\n');

      if (lines.length > limit) {
        return `${result}\n\n[显示前 ${limit} 行，共 ${lines.length} 行]`;
      }

      return result;
    }

    // 完整内容（带行号）
    const numbered = lines.map((line, index) => `${index + 1}→${line}`).join('\n');

    // 截断过大的文件
    return truncateOutput(numbered, MAX_FILE_SIZE);
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
    // 安全路径检查
    const fullPath = safePath(workdir, filePath);

    // 确保父目录存在
    await fs.ensureDir(path.dirname(fullPath));

    // 写入文件
    await fs.writeFile(fullPath, content, 'utf-8');

    // 获取文件大小
    const stats = await fs.stat(fullPath);
    const sizeKB = (stats.size / 1024).toFixed(2);

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
  newText: string
): Promise<string> {
  try {
    // 安全路径检查
    const fullPath = safePath(workdir, filePath);

    // 检查文件是否存在
    if (!(await fs.pathExists(fullPath))) {
      return `错误: 文件不存在: ${filePath}`;
    }

    // 读取文件内容
    const content = await fs.readFile(fullPath, 'utf-8');

    // 检查 old_text 是否存在
    if (!content.includes(oldText)) {
      return `错误: 在文件中未找到要替换的文本。请确保 old_text 精确匹配。\n文件前100字符: ${content.slice(0, 100)}...`;
    }

    // 计算匹配次数
    const matches = content.split(oldText).length - 1;

    if (matches > 1) {
      return `错误: old_text 在文件中出现 ${matches} 次。请提供更具体的文本以确保唯一匹配。`;
    }

    // 替换文本
    const newContent = content.replace(oldText, newText);

    // 写回文件
    await fs.writeFile(fullPath, newContent, 'utf-8');

    // 计算变化
    const oldLines = oldText.split('\n').length;
    const newLines = newText.split('\n').length;
    const lineDiff = newLines - oldLines;

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
