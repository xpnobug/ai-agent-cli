/**
 * Grep 工具 - 快速内容搜索
 * 支持正则表达式、文件过滤、多种输出模式
 */

import fg from 'fast-glob';
import fs from 'fs-extra';
import path from 'node:path';

/**
 * Grep 输出模式
 */
export type GrepOutputMode = 'content' | 'files_with_matches' | 'count';

/**
 * Grep 选项
 */
export interface GrepOptions {
  pattern: string;
  path?: string;
  glob?: string;
  outputMode?: GrepOutputMode;
  caseInsensitive?: boolean;
  contextBefore?: number;
  contextAfter?: number;
  maxResults?: number;
}

/**
 * 匹配结果
 */
interface MatchResult {
  file: string;
  lineNumber: number;
  line: string;
  contextBefore?: string[];
  contextAfter?: string[];
}

/**
 * 执行 Grep 内容搜索
 */
export async function runGrep(
  workdir: string,
  pattern: string,
  searchPath?: string,
  globPattern?: string,
  outputMode: GrepOutputMode = 'files_with_matches',
  caseInsensitive: boolean = false,
  contextBefore: number = 0,
  contextAfter: number = 0,
  maxResults: number = 100
): Promise<string> {
  try {
    const cwd = searchPath ? path.resolve(workdir, searchPath) : workdir;

    // 确定要搜索的文件
    const filePattern = globPattern || '**/*';
    const defaultIgnore = [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/.cache/**',
      '**/coverage/**',
      '**/*.min.js',
      '**/*.map',
    ];

    const files = await fg(filePattern, {
      cwd,
      ignore: defaultIgnore,
      absolute: false,
      onlyFiles: true,
    });

    // 创建正则表达式
    const flags = caseInsensitive ? 'gi' : 'g';
    const regex = new RegExp(pattern, flags);

    // 搜索匹配
    const matches: MatchResult[] = [];
    const filesWithMatches = new Set<string>();
    const fileCounts = new Map<string, number>();

    for (const file of files) {
      const filePath = path.join(cwd, file);

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          if (regex.test(line)) {
            filesWithMatches.add(file);
            fileCounts.set(file, (fileCounts.get(file) || 0) + 1);

            if (outputMode === 'content') {
              // 获取上下文
              const contextBeforeLines =
                contextBefore > 0
                  ? lines.slice(Math.max(0, i - contextBefore), i)
                  : undefined;

              const contextAfterLines =
                contextAfter > 0
                  ? lines.slice(i + 1, Math.min(lines.length, i + 1 + contextAfter))
                  : undefined;

              matches.push({
                file,
                lineNumber: i + 1,
                line,
                contextBefore: contextBeforeLines,
                contextAfter: contextAfterLines,
              });

              // 限制匹配数
              if (matches.length >= maxResults) {
                break;
              }
            }
          }
        }

        if (matches.length >= maxResults) {
          break;
        }
      } catch (err) {
        // 跳过无法读取的文件（二进制文件等）
        continue;
      }
    }

    // 根据输出模式格式化结果
    if (outputMode === 'files_with_matches') {
      if (filesWithMatches.size === 0) {
        return `未找到匹配 "${pattern}" 的文件`;
      }

      const fileList = Array.from(filesWithMatches);
      let result = `找到 ${fileList.length} 个包含匹配的文件:\n\n`;
      result += fileList.join('\n');

      return result;
    } else if (outputMode === 'count') {
      if (fileCounts.size === 0) {
        return `未找到匹配 "${pattern}" 的内容`;
      }

      let result = `匹配统计:\n\n`;
      for (const [file, count] of fileCounts.entries()) {
        result += `${count}:${file}\n`;
      }

      return result;
    } else {
      // content 模式
      if (matches.length === 0) {
        return `未找到匹配 "${pattern}" 的内容`;
      }

      let result = `找到 ${matches.length} 处匹配`;
      if (matches.length >= maxResults) {
        result += ` (已达到最大显示数量 ${maxResults})`;
      }
      result += `:\n\n`;

      for (const match of matches) {
        result += `${match.file}:${match.lineNumber}\n`;

        // 显示上下文
        if (match.contextBefore) {
          for (const line of match.contextBefore) {
            result += `  ${line}\n`;
          }
        }

        result += `> ${match.line}\n`;

        if (match.contextAfter) {
          for (const line of match.contextAfter) {
            result += `  ${line}\n`;
          }
        }

        result += `\n`;
      }

      return result;
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      return `Grep 错误: ${error.message}`;
    }
    return `Grep 错误: ${String(error)}`;
  }
}
