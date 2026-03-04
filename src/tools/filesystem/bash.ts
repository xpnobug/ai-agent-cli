/**
 * Bash 命令执行工具
 */

import { execa } from 'execa';
import type { ToolExecutionResult } from '../../core/types.js';
import { validateBashCommand, validateReadOnlyCommand, truncateOutput } from '../../services/system/security.js';
import { getBackgroundTaskManager } from '../../core/backgroundTasks.js';
import { DEFAULTS } from '../../core/constants.js';

const MAX_OUTPUT_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Bash 工具选项
 */
export interface BashOptions {
  runInBackground?: boolean;
  timeout?: number;
  description?: string;
}

/**
 * 执行 bash 命令
 * @param workdir 工作目录
 * @param command 要执行的命令
 * @param readOnly 是否为只读模式（用于 explore 代理）
 * @param options 额外选项（后台执行、超时等）
 */
export async function runBash(
  workdir: string,
  command: string,
  readOnly: boolean = false,
  options: BashOptions = {}
): Promise<string | ToolExecutionResult> {
  const {
    runInBackground = false,
    timeout = DEFAULTS.bashTimeout,
    description,
  } = options;

  try {
    // 基本安全检查
    validateBashCommand(command);

    // 如果是只读模式，额外检查
    if (readOnly) {
      validateReadOnlyCommand(command);
    }

    // 后台模式
    if (runInBackground) {
      const manager = getBackgroundTaskManager();
      const task = manager.startTask(workdir, command, readOnly, timeout, description);
      const outputFile = task.outputFile ? `输出写入: ${task.outputFile}` : '';
      const text = `命令已在后台运行，任务 ID: ${task.id}${outputFile ? `。${outputFile}` : ''}`;
      return {
        content: text,
        uiContent: text,
        rawOutput: {
          taskId: task.id,
          status: task.status,
          command: task.command,
          description: task.description,
          outputFile: task.outputFile ?? null,
        },
        terminalId: task.id,
      };
    }

    // 前台执行
    const result = await execa('bash', ['-c', command], {
      cwd: workdir,
      timeout,
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
        return `错误: 命令超时（${timeout / 1000}秒限制）`;
      }

      if (error.message.includes('ENOENT')) {
        return '错误: bash 命令不可用。请确保系统已安装 bash。';
      }

      return `错误: ${error.message}`;
    }

    return `错误: ${String(error)}`;
  }
}

/**
 * 获取后台任务输出
 */
export async function runTaskOutput(
  taskId: string,
  block: boolean = true,
  timeout: number = 30000
): Promise<string> {
  const manager = getBackgroundTaskManager();

  if (block) {
    const task = await manager.waitForTask(taskId, timeout);
    if (!task) {
      return `错误: 未找到任务 "${taskId}"`;
    }

    const elapsed = task.endTime
      ? ((task.endTime - task.startTime) / 1000).toFixed(1)
      : ((Date.now() - task.startTime) / 1000).toFixed(1);

    return JSON.stringify({
      taskId: task.id,
      status: task.status,
      exitCode: task.exitCode,
      elapsed: `${elapsed}s`,
      output: task.output || '(无输出)',
    }, null, 2);
  }

  // 非阻塞模式
  const task = manager.getTask(taskId);
  if (!task) {
    return `错误: 未找到任务 "${taskId}"`;
  }

  return JSON.stringify({
    taskId: task.id,
    status: task.status,
    exitCode: task.exitCode,
    output: task.status === 'running' ? '(任务仍在运行...)' : task.output,
  }, null, 2);
}

/**
 * 停止后台任务
 */
export function runTaskStop(taskId: string): Promise<string> {
  const manager = getBackgroundTaskManager();
  const success = manager.cancelTask(taskId);

  if (success) {
    return Promise.resolve(`任务 ${taskId} 已停止`);
  }
  return Promise.resolve(`错误: 无法停止任务 "${taskId}"（可能不存在或已完成）`);
}
