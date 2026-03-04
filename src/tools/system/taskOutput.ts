/**
 * TaskOutput 工具实现
 */

import type { ToolExecutionResult } from '../../core/types.js';
import { getBackgroundTaskManager } from '../../core/backgroundTasks.js';
import {
  getBackgroundAgentTaskSnapshot,
  waitForBackgroundAgentTask,
  markBackgroundAgentTaskRetrieved,
} from '../../services/session/backgroundAgentTasks.js';
import { readTaskOutput } from '../../services/session/taskOutputStore.js';

type TaskType = 'local_bash' | 'local_agent';
type TaskStatus = 'running' | 'pending' | 'completed' | 'failed' | 'killed';

type TaskSummary = {
  task_id: string;
  task_type: TaskType;
  status: TaskStatus;
  description: string;
  output?: string;
  exitCode?: number | null;
  prompt?: string;
  result?: string;
  error?: string;
};

type Output = {
  retrieval_status: 'success' | 'timeout' | 'not_ready';
  task: TaskSummary | null;
};

function normalizeTaskOutputInput(input: Record<string, unknown>): {
  taskId: string;
  block: boolean;
  timeout: number;
} {
  const taskId =
    (typeof input.task_id === 'string' && input.task_id) ||
    (typeof input.agentId === 'string' && String(input.agentId)) ||
    (typeof input.bash_id === 'string' && String(input.bash_id)) ||
    '';

  const block = typeof input.block === 'boolean' ? input.block : true;

  const timeout =
    typeof input.timeout === 'number'
      ? input.timeout
      : typeof input.wait_up_to === 'number'
        ? Number(input.wait_up_to) * 1000
        : 30000;

  return { taskId, block, timeout };
}

function taskStatusFromBash(status: string): TaskStatus {
  if (status === 'running') return 'running';
  if (status === 'cancelled') return 'killed';
  if (status === 'completed') return 'completed';
  return 'failed';
}

function buildTaskSummary(taskId: string): TaskSummary | null {
  const manager = getBackgroundTaskManager();
  const bashTask = manager.getTask(taskId);
  if (bashTask) {
    return {
      task_id: taskId,
      task_type: 'local_bash',
      status: taskStatusFromBash(bashTask.status),
      description: bashTask.description || bashTask.command,
      output: readTaskOutput(taskId),
      exitCode: bashTask.exitCode ?? null,
    };
  }

  const agent = getBackgroundAgentTaskSnapshot(taskId);
  if (agent) {
    const output = readTaskOutput(taskId) || agent.resultText || '';
    return {
      task_id: taskId,
      task_type: 'local_agent',
      status: agent.status,
      description: agent.description,
      output,
      prompt: agent.prompt,
      result: output,
      error: agent.error,
    };
  }

  return null;
}

async function waitForBashTaskCompletion(args: {
  taskId: string;
  timeoutMs: number;
  signal?: AbortSignal;
}): Promise<TaskSummary | null> {
  const { taskId, timeoutMs, signal } = args;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (signal?.aborted) return null;
    const summary = buildTaskSummary(taskId);
    if (!summary) return null;
    if (summary.status !== 'running' && summary.status !== 'pending') return summary;
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return buildTaskSummary(taskId);
}

function renderResultForAssistant(output: Output): string {
  const parts: string[] = [];
  parts.push(`<retrieval_status>${output.retrieval_status}</retrieval_status>`);

  if (output.task) {
    parts.push(`<task_id>${output.task.task_id}</task_id>`);
    parts.push(`<task_type>${output.task.task_type}</task_type>`);
    parts.push(`<status>${output.task.status}</status>`);
    if (output.task.exitCode !== undefined && output.task.exitCode !== null) {
      parts.push(`<exit_code>${output.task.exitCode}</exit_code>`);
    }
    if (output.task.output?.trim()) {
      parts.push(`<output>\n${output.task.output.trimEnd()}\n</output>`);
    }
    if (output.task.error) {
      parts.push(`<error>${output.task.error}</error>`);
    }
  }

  return parts.join('\n\n');
}

function renderUi(output: Output): string {
  if (output.retrieval_status === 'timeout' || output.retrieval_status === 'not_ready') {
    return '任务仍在运行...';
  }

  if (!output.task) {
    return '没有可用的任务输出';
  }

  if (output.task.task_type === 'local_agent') {
    if (output.task.result && output.task.result.trim()) {
      return output.task.result;
    }
    return output.task.error ? `错误: ${output.task.error}` : '(无输出)';
  }

  const content = output.task.output?.trim() ?? '';
  return content || '(无输出)';
}

function getTerminalId(task: TaskSummary | null): string | undefined {
  if (!task) return undefined;
  if (task.task_type !== 'local_bash') return undefined;
  return task.task_id;
}

export async function runTaskOutput(
  input: Record<string, unknown>,
  signal?: AbortSignal
): Promise<ToolExecutionResult> {
  const normalized = normalizeTaskOutputInput(input);
  const taskId = normalized.taskId;
  const block = normalized.block;
  const timeoutMs = normalized.timeout;

  if (!taskId) {
    return {
      content: 'Task ID is required',
      uiContent: '错误: 缺少任务 ID',
      isError: true,
      rawOutput: {
        error: 'missing_task_id',
      },
    };
  }

  const initial = buildTaskSummary(taskId);
  if (!initial) {
    return {
      content: `No task found with ID: ${taskId}`,
      uiContent: `错误: 未找到任务 "${taskId}"`,
      isError: true,
      rawOutput: {
        task_id: taskId,
        error: 'task_not_found',
      },
    };
  }

  if (!block) {
    const isDone = initial.status !== 'running' && initial.status !== 'pending';
    const out: Output = {
      retrieval_status: isDone ? 'success' : 'not_ready',
      task: initial,
    };
    if (isDone && initial.task_type === 'local_agent') {
      markBackgroundAgentTaskRetrieved(taskId);
    }
    return {
      content: renderResultForAssistant(out),
      uiContent: renderUi(out),
      isError: false,
      rawOutput: out,
      terminalId: getTerminalId(initial),
    };
  }

  let finalTask: TaskSummary | null = null;

  if (initial.task_type === 'local_agent') {
    try {
      const task = await waitForBackgroundAgentTask(
        taskId,
        timeoutMs,
        signal ?? new AbortController().signal
      );
      finalTask = task ? buildTaskSummary(taskId) : null;
    } catch {
      finalTask = buildTaskSummary(taskId);
    }
  } else {
    finalTask = await waitForBashTaskCompletion({ taskId, timeoutMs, signal });
  }

  if (!finalTask) {
    const out: Output = { retrieval_status: 'timeout', task: null };
    return {
      content: renderResultForAssistant(out),
      uiContent: renderUi(out),
      isError: false,
      rawOutput: out,
      terminalId: getTerminalId(finalTask),
    };
  }

  if (finalTask.status === 'running' || finalTask.status === 'pending') {
    const out: Output = { retrieval_status: 'timeout', task: finalTask };
    return {
      content: renderResultForAssistant(out),
      uiContent: renderUi(out),
      isError: false,
      rawOutput: out,
      terminalId: getTerminalId(finalTask),
    };
  }

  const out: Output = { retrieval_status: 'success', task: finalTask };
  if (finalTask.task_type === 'local_agent') {
    markBackgroundAgentTaskRetrieved(taskId);
  }
  return {
    content: renderResultForAssistant(out),
    uiContent: renderUi(out),
    isError: false,
    rawOutput: out,
    terminalId: getTerminalId(finalTask),
  };
}
