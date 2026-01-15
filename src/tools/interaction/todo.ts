/**
 * Todo 管理工具
 */

import type { TodoItem } from '../types.js';

/**
 * Todo 约束常量
 */
const MAX_TODO_ITEMS = 20;

/**
 * Todo 管理器
 */
export class TodoManager {
  private todos: TodoItem[] = [];

  /**
   * 更新 todo 列表
   */
  update(items: TodoItem[]): string {
    try {
      // 检查最大条目数
      if (items.length > MAX_TODO_ITEMS) {
        return `错误: 最多允许 ${MAX_TODO_ITEMS} 个任务，当前有 ${items.length} 个`;
      }

      // 验证每个条目
      const seenIds = new Set<string>();
      let inProgressCount = 0;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        // 验证状态
        if (!['pending', 'in_progress', 'completed'].includes(item.status)) {
          return `错误: 任务 ${i + 1} 的状态 "${item.status}" 无效。必须是 pending、in_progress 或 completed`;
        }

        // 验证 content 非空
        if (!item.content || item.content.trim() === '') {
          return `错误: 任务 ${i + 1} 的 content 不能为空`;
        }

        // 验证 activeForm 非空
        if (!item.activeForm || item.activeForm.trim() === '') {
          return `错误: 任务 ${i + 1} 的 activeForm 不能为空`;
        }

        // 检查重复 id（如果有）
        if (item.id) {
          if (seenIds.has(item.id)) {
            return `错误: 任务 ID "${item.id}" 重复`;
          }
          seenIds.add(item.id);
        }

        // 统计 in_progress 数量
        if (item.status === 'in_progress') {
          inProgressCount++;
        }
      }

      // 检查 in_progress 数量
      if (inProgressCount > 1) {
        return `错误: 同时只能有 1 个任务为 in_progress 状态，当前有 ${inProgressCount} 个`;
      }

      // 更新列表
      this.todos = items.map((item, index) => ({
        ...item,
        id: item.id || `todo-${index + 1}`,
        content: item.content.trim(),
        activeForm: item.activeForm.trim(),
      }));

      // 返回格式化的列表
      return this.render();
    } catch (error: unknown) {
      if (error instanceof Error) {
        return `错误: ${error.message}`;
      }
      return `错误: ${String(error)}`;
    }
  }

  /**
   * 渲染 todo 列表
   */
  render(): string {
    if (this.todos.length === 0) {
      return '任务列表为空';
    }

    const lines: string[] = [];

    for (let i = 0; i < this.todos.length; i++) {
      const item = this.todos[i];
      const num = `${i + 1}.`;

      if (item.status === 'completed') {
        lines.push(`  ✓ ${num} ${item.content}`);
      } else if (item.status === 'in_progress') {
        lines.push(`  ● ${num} ${item.activeForm}...`);
      } else {
        lines.push(`  ○ ${num} ${item.content}`);
      }
    }

    // 添加统计信息
    const completed = this.todos.filter((t) => t.status === 'completed').length;
    const total = this.todos.length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    lines.push('');
    lines.push(`进度: ${completed}/${total} (${progress}%)`);

    return lines.join('\n');
  }

  /**
   * 获取当前 todo 列表
   */
  getTodos(): TodoItem[] {
    return this.todos;
  }

  /**
   * 获取任务数量
   */
  getCount(): number {
    return this.todos.length;
  }

  /**
   * 清空列表
   */
  clear(): void {
    this.todos = [];
  }
}

/**
 * 全局 TodoManager 实例
 */
let todoManagerInstance: TodoManager | null = null;

export function getTodoManager(): TodoManager {
  if (!todoManagerInstance) {
    todoManagerInstance = new TodoManager();
  }
  return todoManagerInstance;
}

/**
 * 执行 TodoWrite 工具
 */
export function runTodoWrite(items: TodoItem[]): Promise<string> {
  const manager = getTodoManager();
  return Promise.resolve(manager.update(items));
}
