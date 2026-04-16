/**
 * useScheduledTasks — 定时任务管理 Hook
 *
 * 功能：管理 cron 风格的定时任务，到期时触发回调。
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface ScheduledTask {
  id: string;
  /** cron 表达式或毫秒间隔 */
  intervalMs: number;
  /** 任务描述 */
  description: string;
  /** 下次执行时间 */
  nextRunAt: number;
  /** 是否启用 */
  enabled: boolean;
}

interface ScheduledTasksState {
  tasks: ScheduledTask[];
  addTask: (description: string, intervalMs: number) => string;
  removeTask: (id: string) => void;
  toggleTask: (id: string) => void;
}

let _taskId = 0;

export function useScheduledTasks(
  onTaskDue: (task: ScheduledTask) => void,
): ScheduledTasksState {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  const addTask = useCallback((description: string, intervalMs: number): string => {
    const id = `task_${++_taskId}`;
    const task: ScheduledTask = {
      id,
      intervalMs,
      description,
      nextRunAt: Date.now() + intervalMs,
      enabled: true,
    };
    setTasks((prev) => [...prev, task]);
    return id;
  }, []);

  const removeTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toggleTask = useCallback((id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t)),
    );
  }, []);

  // 定时检查到期任务
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const current = tasksRef.current;
      let updated = false;

      const next = current.map((task) => {
        if (!task.enabled || now < task.nextRunAt) return task;
        onTaskDue(task);
        updated = true;
        return { ...task, nextRunAt: now + task.intervalMs };
      });

      if (updated) setTasks(next);
    }, 1000);

    return () => clearInterval(interval);
  }, [onTaskDue]);

  return { tasks, addTask, removeTask, toggleTask };
}
