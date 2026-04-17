/**
 * CronCreate / CronList / CronDelete 工具实现
 *
 * 复用现有 utils/cronTasks.ts 的存储层，
 * 只提供面向 LLM 的薄包装：校验 cron 表达式 + 规范化返回格式。
 */

import { parseCronExpression } from '../../utils/cron.js';
import {
  addCronTask,
  listAllCronTasks,
  removeCronTasks,
  type CronTask,
} from '../../utils/cronTasks.js';

export interface CronCreateInput {
  cron?: string;
  prompt?: string;
  recurring?: boolean;
  durable?: boolean;
}

export async function runCronCreate(input: CronCreateInput): Promise<string> {
  const cron = typeof input.cron === 'string' ? input.cron.trim() : '';
  const prompt = typeof input.prompt === 'string' ? input.prompt : '';
  if (!cron) return '错误: cron 参数必填（5 字段 cron 表达式）';
  if (!prompt) return '错误: prompt 参数必填';
  if (!parseCronExpression(cron)) {
    return `错误: 无法解析 cron 表达式 "${cron}"，应为 "分 时 日 月 周" 5 字段格式。`;
  }
  const recurring = input.recurring !== false; // 默认 true，与工具说明一致
  const durable = !!input.durable;

  try {
    const id = await addCronTask(cron, prompt, recurring, durable);
    return JSON.stringify({
      id,
      cron,
      recurring,
      durable,
      note: durable ? '已持久化到 .ai-agent/scheduled_tasks.json' : '仅当前会话有效',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `错误: 创建定时任务失败: ${msg}`;
  }
}

export async function runCronList(): Promise<string> {
  try {
    const tasks = await listAllCronTasks();
    if (tasks.length === 0) return '（无定时任务）';
    const lines = tasks.map((t: CronTask) => {
      const parts = [
        `· ${t.id}`,
        `cron=${t.cron}`,
        t.recurring ? 'recurring' : 'one-shot',
        t.durable === false ? 'session' : 'durable',
      ];
      const head = parts.join(' | ');
      const body = t.prompt.length > 60 ? `${t.prompt.slice(0, 60)}…` : t.prompt;
      return `${head}\n  → ${body}`;
    });
    return lines.join('\n');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `错误: 读取定时任务失败: ${msg}`;
  }
}

export interface CronDeleteInput {
  id?: string;
  ids?: string[];
}

export async function runCronDelete(input: CronDeleteInput): Promise<string> {
  const ids = Array.isArray(input.ids)
    ? input.ids
    : typeof input.id === 'string'
      ? [input.id]
      : [];
  if (ids.length === 0) return '错误: 至少提供一个 id 或 ids 数组';
  try {
    await removeCronTasks(ids);
    return `已删除 ${ids.length} 个任务：${ids.join(', ')}`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `错误: 删除定时任务失败: ${msg}`;
  }
}
