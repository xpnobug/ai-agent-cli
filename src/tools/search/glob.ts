/**
 * Glob 工具 - 快速文件模式匹配
 * 使用 fast-glob 库实现高性能文件搜索
 */

import fg from 'fast-glob';
import path from 'node:path';

const MAX_RESULTS = 10000; // 最大返回文件数

/**
 * Glob 匹配选项
 */
export interface GlobOptions {
  pattern: string;
  path?: string;
  ignore?: string[];
  maxResults?: number;
}

/**
 * 执行 Glob 文件搜索
 */
export async function runGlob(
  workdir: string,
  pattern: string,
  searchPath?: string,
  ignore?: string[],
  maxResults: number = MAX_RESULTS
): Promise<string> {
  try {
    const cwd = searchPath ? path.resolve(workdir, searchPath) : workdir;

    // 默认忽略模式
    const defaultIgnore = [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/.cache/**',
      '**/coverage/**',
      '**/.DS_Store',
    ];

    const ignorePatterns = ignore ? [...defaultIgnore, ...ignore] : defaultIgnore;

    // 执行 glob 搜索
    const files = await fg(pattern, {
      cwd,
      ignore: ignorePatterns,
      absolute: false, // 返回相对路径
      onlyFiles: true,
      followSymbolicLinks: false,
      stats: true, // 获取文件状态（用于排序）
    });

    // 按修改时间排序（最近修改的在前）
    const sortedFiles = files
      .sort((a, b) => {
        const aTime = a.stats?.mtime?.getTime() || 0;
        const bTime = b.stats?.mtime?.getTime() || 0;
        return bTime - aTime;
      })
      .map((entry) => entry.path);

    // 限制结果数量
    const limitedFiles = sortedFiles.slice(0, maxResults);

    if (limitedFiles.length === 0) {
      return `未找到匹配 "${pattern}" 的文件`;
    }

    // 格式化输出
    let result = `找到 ${limitedFiles.length} 个匹配文件`;
    if (sortedFiles.length > maxResults) {
      result += ` (显示前 ${maxResults} 个，共 ${sortedFiles.length} 个)`;
    }
    result += `:\n\n${limitedFiles.join('\n')}`;

    return result;
  } catch (error: unknown) {
    if (error instanceof Error) {
      return `Glob 错误: ${error.message}`;
    }
    return `Glob 错误: ${String(error)}`;
  }
}
