/**
 * 增强任务管理系统
 * 支持任务依赖（blocks/blockedBy）、所有者、元数据等
 */

/**
 * 任务状态
 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'deleted';

/**
 * 任务定义
 */
export interface Task {
  id: string;
  subject: string;
  description: string;
  status: TaskStatus;
  owner?: string;
  activeForm?: string;
  metadata?: Record<string, unknown>;
  blocks: string[];
  blockedBy: string[];
  createdAt: number;
  updatedAt: number;
}

/**
 * 创建任务输入
 */
export interface TaskCreateInput {
  subject: string;
  description: string;
  activeForm?: string;
  owner?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 更新任务输入
 */
export interface TaskUpdateInput {
  taskId: string;
  subject?: string;
  description?: string;
  status?: TaskStatus;
  activeForm?: string;
  owner?: string;
  metadata?: Record<string, unknown>;
  addBlocks?: string[];
  addBlockedBy?: string[];
}

/**
 * 任务存储
 */
export class TaskStore {
  private tasks = new Map<string, Task>();
  private nextId = 1;

  /**
   * 创建任务
   */
  create(input: TaskCreateInput): Task {
    const id = String(this.nextId++);
    const task: Task = {
      id,
      subject: input.subject,
      description: input.description,
      status: 'pending',
      activeForm: input.activeForm,
      owner: input.owner,
      metadata: input.metadata,
      blocks: [],
      blockedBy: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.tasks.set(id, task);
    return task;
  }

  /**
   * 获取任务
   */
  get(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  /**
   * 更新任务
   */
  update(input: TaskUpdateInput): Task | undefined {
    const task = this.tasks.get(input.taskId);
    if (!task) return undefined;

    if (input.subject !== undefined) task.subject = input.subject;
    if (input.description !== undefined) task.description = input.description;
    if (input.activeForm !== undefined) task.activeForm = input.activeForm;
    if (input.owner !== undefined) task.owner = input.owner;

    if (input.status !== undefined) {
      if (input.status === 'deleted') {
        this.tasks.delete(input.taskId);
        return task;
      }
      task.status = input.status;
    }

    // 合并元数据
    if (input.metadata) {
      if (!task.metadata) task.metadata = {};
      for (const [key, value] of Object.entries(input.metadata)) {
        if (value === null) {
          delete task.metadata[key];
        } else {
          task.metadata[key] = value;
        }
      }
    }

    // 添加依赖关系
    if (input.addBlocks) {
      for (const blockId of input.addBlocks) {
        if (!task.blocks.includes(blockId)) {
          task.blocks.push(blockId);
        }
        // 双向更新
        const blocked = this.tasks.get(blockId);
        if (blocked && !blocked.blockedBy.includes(task.id)) {
          blocked.blockedBy.push(task.id);
        }
      }
    }

    if (input.addBlockedBy) {
      for (const blockerId of input.addBlockedBy) {
        if (!task.blockedBy.includes(blockerId)) {
          task.blockedBy.push(blockerId);
        }
        // 双向更新
        const blocker = this.tasks.get(blockerId);
        if (blocker && !blocker.blocks.includes(task.id)) {
          blocker.blocks.push(task.id);
        }
      }
    }

    task.updatedAt = Date.now();
    return task;
  }

  /**
   * 列出所有任务（不含已删除）
   */
  list(): Task[] {
    return Array.from(this.tasks.values());
  }

  /**
   * 删除任务
   */
  delete(id: string): boolean {
    const task = this.tasks.get(id);
    if (!task) return false;

    // 清理依赖关系
    for (const blockId of task.blocks) {
      const blocked = this.tasks.get(blockId);
      if (blocked) {
        blocked.blockedBy = blocked.blockedBy.filter(b => b !== id);
      }
    }
    for (const blockerId of task.blockedBy) {
      const blocker = this.tasks.get(blockerId);
      if (blocker) {
        blocker.blocks = blocker.blocks.filter(b => b !== id);
      }
    }

    return this.tasks.delete(id);
  }
}

// 单例
let storeInstance: TaskStore | null = null;

export function getTaskStore(): TaskStore {
  if (!storeInstance) {
    storeInstance = new TaskStore();
  }
  return storeInstance;
}

/**
 * 运行 TaskCreate 工具
 */
export function runTaskCreate(input: Record<string, unknown>): string {
  const store = getTaskStore();
  const task = store.create({
    subject: input.subject as string,
    description: input.description as string,
    activeForm: input.activeForm as string | undefined,
    owner: input.owner as string | undefined,
    metadata: input.metadata as Record<string, unknown> | undefined,
  });

  return JSON.stringify({
    id: task.id,
    subject: task.subject,
    status: task.status,
    message: `任务 #${task.id} 已创建`,
  }, null, 2);
}

/**
 * 运行 TaskGet 工具
 */
export function runTaskGet(taskId: string): string {
  const store = getTaskStore();
  const task = store.get(taskId);

  if (!task) {
    return `错误: 未找到任务 #${taskId}`;
  }

  // 过滤 blockedBy 中已完成的任务
  const openBlockedBy = task.blockedBy.filter(id => {
    const blocker = store.get(id);
    return blocker && blocker.status !== 'completed';
  });

  return JSON.stringify({
    ...task,
    blockedBy: openBlockedBy,
  }, null, 2);
}

/**
 * 运行 TaskUpdate 工具
 */
export function runTaskUpdate(input: Record<string, unknown>): string {
  const store = getTaskStore();
  const task = store.update({
    taskId: input.taskId as string,
    subject: input.subject as string | undefined,
    description: input.description as string | undefined,
    status: input.status as TaskStatus | undefined,
    activeForm: input.activeForm as string | undefined,
    owner: input.owner as string | undefined,
    metadata: input.metadata as Record<string, unknown> | undefined,
    addBlocks: input.addBlocks as string[] | undefined,
    addBlockedBy: input.addBlockedBy as string[] | undefined,
  });

  if (!task) {
    return `错误: 未找到任务 #${input.taskId}`;
  }

  if (input.status === 'deleted') {
    return `任务 #${input.taskId} 已删除`;
  }

  return JSON.stringify({
    id: task.id,
    subject: task.subject,
    status: task.status,
    message: `任务 #${task.id} 已更新`,
  }, null, 2);
}

/**
 * 运行 TaskList 工具
 */
export function runTaskList(): string {
  const store = getTaskStore();
  const tasks = store.list();

  if (tasks.length === 0) {
    return '当前没有任务';
  }

  const summary = tasks.map(task => {
    // 过滤 blockedBy 中已完成的任务
    const openBlockedBy = task.blockedBy.filter(id => {
      const blocker = store.get(id);
      return blocker && blocker.status !== 'completed';
    });

    return {
      id: task.id,
      subject: task.subject,
      status: task.status,
      owner: task.owner || '',
      blockedBy: openBlockedBy,
    };
  });

  return JSON.stringify(summary, null, 2);
}
