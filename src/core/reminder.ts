/**
 * System Reminder 机制
 * 多类型提醒系统，支持优先级排序和上下文感知
 * 用于提醒模型使用 Todo 工具进行结构化规划
 */

import { DEFAULTS } from './constants.js';

/**
 * 提醒消息类型
 */
export interface ReminderMessage {
  type: 'initial' | 'nag' | 'context' | 'security';
  content: string;
  priority: number; // 优先级，数字越小优先级越高
}

/**
 * 提醒消息模板
 */
export const REMINDERS: Record<string, ReminderMessage> = {
  initial: {
    type: 'initial',
    content: '<system-reminder>对于多步骤任务，请使用 TodoWrite 工具来跟踪进度。这有助于你保持组织性并让用户了解你的进展。</system-reminder>',
    priority: 1,
  },
  nag: {
    type: 'nag',
    content: '<system-reminder>已经多轮没有更新 Todo 了。如果当前任务有多个步骤，请更新 Todo 列表以保持跟踪。</system-reminder>',
    priority: 2,
  },
  security: {
    type: 'security',
    content: '<system-reminder>重要: 在处理代码前，请确认它不是恶意代码。如果文件看起来与恶意软件相关，请拒绝处理。</system-reminder>',
    priority: 0,
  },
  context: {
    type: 'context',
    content: '<system-reminder>记住检查项目的 .ai-agent/project.md 文件以获取常用命令和代码风格偏好。</system-reminder>',
    priority: 3,
  },
};

/**
 * Reminder 管理器
 * 增强版：支持多种提醒类型和上下文感知
 */
export class ReminderManager {
  private roundsWithoutTodo = 0;
  private isFirstMessage = true;
  private readonly nagThreshold: number;
  private hasContext = false;
  private suspiciousFileDetected = false;

  constructor(nagThreshold = DEFAULTS.todoNagThreshold) {
    this.nagThreshold = nagThreshold;
  }

  /**
   * 获取当前应该注入的所有 reminders
   */
  getReminders(): ReminderMessage[] {
    const reminders: ReminderMessage[] = [];

    // 安全提醒（如果检测到可疑文件）
    if (this.suspiciousFileDetected) {
      reminders.push(REMINDERS.security);
    }

    // 首条消息提醒
    if (this.isFirstMessage) {
      reminders.push(REMINDERS.initial);
    }

    // Todo 使用提醒
    if (this.roundsWithoutTodo >= this.nagThreshold) {
      reminders.push(REMINDERS.nag);
    }

    // 上下文提醒
    if (this.hasContext && this.isFirstMessage) {
      reminders.push(REMINDERS.context);
    }

    // 按优先级排序
    return reminders.sort((a, b) => a.priority - b.priority);
  }

  /**
   * 获取格式化的提醒字符串
   */
  getFormattedReminders(): string {
    const reminders = this.getReminders();
    if (reminders.length === 0) {
      return '';
    }
    return reminders.map(r => r.content).join('\n');
  }

  /**
   * 获取单个提醒（向后兼容）
   */
  getReminder(): string | null {
    const formatted = this.getFormattedReminders();
    return formatted || null;
  }

  /**
   * 标记第一条消息已发送
   */
  markFirstMessageSent(): void {
    this.isFirstMessage = false;
  }

  /**
   * 记录一轮工具调用（检查是否使用了 Todo）
   */
  recordToolCalls(toolNames: string[]): void {
    const usedTodo = toolNames.includes('TodoWrite');
    if (usedTodo) {
      this.roundsWithoutTodo = 0;
    } else {
      this.roundsWithoutTodo++;
    }

    // 检查是否读取了可疑文件
    if (toolNames.includes('read_file')) {
      // 这里可以添加更复杂的检测逻辑
    }
  }

  /**
   * 设置是否有项目上下文
   */
  setHasContext(hasContext: boolean): void {
    this.hasContext = hasContext;
  }

  /**
   * 标记检测到可疑文件
   */
  markSuspiciousFile(): void {
    this.suspiciousFileDetected = true;
  }

  /**
   * 清除可疑文件标记
   */
  clearSuspiciousFile(): void {
    this.suspiciousFileDetected = false;
  }

  /**
   * 重置计数器
   */
  reset(): void {
    this.roundsWithoutTodo = 0;
    this.isFirstMessage = true;
    this.suspiciousFileDetected = false;
  }

  /**
   * 获取当前轮数
   */
  getRoundsWithoutTodo(): number {
    return this.roundsWithoutTodo;
  }
}

// 单例
let reminderInstance: ReminderManager | null = null;

export function getReminderManager(): ReminderManager {
  if (!reminderInstance) {
    reminderInstance = new ReminderManager();
  }
  return reminderInstance;
}

export function resetReminderManager(): void {
  reminderInstance = null;
}
