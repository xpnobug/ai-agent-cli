/**
 * 后台任务列表聚合
 */

import { getBackgroundTaskManager } from '../../core/backgroundTasks.js';
import { listBackgroundAgentTasks } from './backgroundAgentTasks.js';

export type TaskListItem = {
  id: string;
  taskType: 'bash' | 'agent';
  status: string;
  description: string;
  startedAt: number;
  completedAt?: number;
  retrieved?: boolean;
};

export function listTaskItems(): TaskListItem[] {
  const manager = getBackgroundTaskManager();
  const bashTasks = manager.listTasks();
  const agentTasks = listBackgroundAgentTasks();

  const items: TaskListItem[] = [
    ...bashTasks.map(task => ({
      id: task.id,
      taskType: 'bash' as const,
      status: task.status,
      description: task.description || task.command,
      startedAt: task.startTime,
      completedAt: task.endTime,
    })),
    ...agentTasks.map(task => ({
      id: task.agentId,
      taskType: 'agent' as const,
      status: task.status,
      description: task.description,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      retrieved: task.retrieved,
    })),
  ];

  return items.sort((a, b) => b.startedAt - a.startedAt);
}
