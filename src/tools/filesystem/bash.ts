/**
 * Bash 命令执行工具
 */

import { execa } from 'execa';
import { validateBashCommand, validateReadOnlyCommand, truncateOutput } from '../../services/system/security.js';

const BASH_TIMEOUT = 60000; // 60 秒
const MAX_OUTPUT_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * 执行 bash 命令
 * @param workdir 工作目录
 * @param command 要执行的命令
 * @param readOnly 是否为只读模式（用于 explore 代理）
 */
export async function runBash(workdir: string, command: string, readOnly: boolean = false): Promise<string> {
  try {
    // 基本安全检查
    validateBashCommand(command);

    // 如果是只读模式，额外检查
    if (readOnly) {
      validateReadOnlyCommand(command);
    }

    // 执行命令
    const result = await execa('bash', ['-c', command], {
      cwd: workdir,
      timeout: BASH_TIMEOUT,
      maxBuffer: MAX_OUTPUT_SIZE,
      reject: false, // 不抛出异常，而是返回结果
      all: true, // 合并 stdout 和 stderr
    });

    // 获取输出
    const output = result.all || '';

    // 检查是否有输出
    if (!output.trim()) {
      return `命令执行成功（无输出）\n退出码: ${result.exitCode}`;
    }

    // 截断过长的输出
    const truncated = truncateOutput(output, MAX_OUTPUT_SIZE);

    // 添加退出码信息
    if (result.exitCode !== 0) {
      return `${truncated}\n\n退出码: ${result.exitCode} (命令执行失败)`;
    }

    return truncated;
  } catch (error: unknown) {
    // 处理各种错误
    if (error instanceof Error) {
      if (error.message.includes('timed out')) {
        return `错误: 命令超时（${BASH_TIMEOUT / 1000}秒限制）`;
      }

      if (error.message.includes('ENOENT')) {
        return '错误: bash 命令不可用。请确保系统已安装 bash。';
      }

      return `错误: ${error.message}`;
    }

    return `错误: ${String(error)}`;
  }
}
