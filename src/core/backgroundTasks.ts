/**
 * 后台任务管理系统
 * 支持 bash 命令后台执行、状态查询、结果获取和取消
 */

import { execa } from 'execa';
import type { ExecaChildProcess } from 'execa';
import { validateBashCommand, validateReadOnlyCommand, truncateOutput } from '../services/system/security.js';
import { appendTaskOutput, readTaskOutput, touchTaskOutputFile } from '../services/session/taskOutputStore.js';

const MAX_OUTPUT_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * 后台任务状态
 */
export type BackgroundTaskStatus = 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * 后台任务
 */
export interface BackgroundTask {
  id: string;
  command: string;
  description?: string;
  status: BackgroundTaskStatus;
  output: string;
  outputFile?: string;
  startTime: number;
  endTime?: number;
  exitCode?: number;
}

/**
 * 后台任务管理器
 */
export class BackgroundTaskManager {
  private tasks = new Map<string, BackgroundTask>();
  private processes = new Map<string, ExecaChildProcess<string>>();
  private nextId = 1;

  /**
   * 启动后台任务
   */
  startTask(
    workdir: string,
    command: string,
    readOnly: boolean = false,
    timeout: number = 300000,
    description?: string
  ): BackgroundTask {
    // 安全检查
    validateBashCommand(command);
    if (readOnly) {
      validateReadOnlyCommand(command);
    }

    const id = `bg-${this.nextId++}`;
    const task: BackgroundTask = {
      id,
      command,
      description,
      status: 'running',
      output: '',
      startTime: Date.now(),
    };

    task.outputFile = touchTaskOutputFile(id, workdir);

    this.tasks.set(id, task);

    // 启动进程
    const proc = execa('bash', ['-c', command], {
      cwd: workdir,
      timeout,
      maxBuffer: MAX_OUTPUT_SIZE,
      reject: false,
      all: true,
    });

    this.processes.set(id, proc);

    // 实时写入输出
    if (proc.all) {
      proc.all.on('data', (chunk) => {
        const text = chunk.toString('utf8');
        appendTaskOutput(id, text, workdir);
        task.output = truncateOutput(task.output + text, MAX_OUTPUT_SIZE);
      });
    }

    // 监听完成
    proc.then((result) => {
      const finalOutput = task.output || readTaskOutput(id, workdir);
      task.output = truncateOutput(finalOutput || result.all || '', MAX_OUTPUT_SIZE);
      task.exitCode = result.exitCode;
      task.endTime = Date.now();
      task.status = result.exitCode === 0 ? 'completed' : 'failed';
      this.processes.delete(id);
    }).catch((error: unknown) => {
      const errorMsg = error instanceof Error ? error.message : String(error);
      task.output = `错误: ${errorMsg}`;
      task.endTime = Date.now();
      task.status = 'failed';
      this.processes.delete(id);
    });

    return task;
  }

  /**
   * 获取任务信息
   */
  getTask(id: string): BackgroundTask | undefined {
    return this.tasks.get(id);
  }

  /**
   * 等待任务完成
   */
  async waitForTask(id: string, timeout: number = 30000): Promise<BackgroundTask | undefined> {
    const task = this.tasks.get(id);
    if (!task) return undefined;

    if (task.status !== 'running') return task;

    const proc = this.processes.get(id);
    if (!proc) return task;

    // 等待完成或超时
    const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, timeout));
    await Promise.race([proc, timeoutPromise]);

    return this.tasks.get(id);
  }

  /**
   * 列出所有任务
   */
  listTasks(): BackgroundTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * 取消任务
   */
  cancelTask(id: string): boolean {
    const task = this.tasks.get(id);
    if (!task || task.status !== 'running') return false;

    const proc = this.processes.get(id);
    if (proc) {
      proc.kill();
      this.processes.delete(id);
    }

    task.status = 'cancelled';
    task.endTime = Date.now();
    return true;
  }
}

// 单例
let managerInstance: BackgroundTaskManager | null = null;

export function getBackgroundTaskManager(): BackgroundTaskManager {
  if (!managerInstance) {
    managerInstance = new BackgroundTaskManager();
  }
  return managerInstance;
}
