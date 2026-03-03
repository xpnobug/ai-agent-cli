/**
 * Agent 会话管理
 * 提供子代理会话的存储和恢复功能
 */

import type { AgentType, Message } from './types.js';
import { generateUuid } from '../utils/uuid.js';

/**
 * Agent 会话
 */
export interface AgentSession {
  id: string;
  agentType: AgentType;
  history: Message[];
  status: 'running' | 'completed' | 'failed';
  result?: string;
  model?: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Agent 会话存储
 */
export class AgentSessionStore {
  private sessions = new Map<string, AgentSession>();
  private nextId = 1;

  /**
   * 创建新会话
   */
  create(agentType: AgentType, description?: string, model?: string): AgentSession {
    const id = `agent-${this.nextId++}`;
    const session: AgentSession = {
      id,
      agentType,
      description,
      history: [],
      status: 'running',
      model,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.sessions.set(id, session);
    return session;
  }

  /**
   * 获取会话
   */
  get(id: string): AgentSession | undefined {
    return this.sessions.get(id);
  }

  /**
   * 更新会话
   */
  update(id: string, updates: Partial<AgentSession>): void {
    const session = this.sessions.get(id);
    if (session) {
      Object.assign(session, updates, { updatedAt: Date.now() });
    }
  }

  /**
   * 恢复会话 - 向历史中追加消息并继续
   */
  resume(id: string, message: string): AgentSession | undefined {
    const session = this.sessions.get(id);
    if (!session) return undefined;

    // 追加用户消息
    session.history.push({
      role: 'user',
      content: message,
      uuid: generateUuid(),
    });

    session.status = 'running';
    session.updatedAt = Date.now();
    return session;
  }

  /**
   * 列出所有会话
   */
  list(): AgentSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * 列出活动会话
   */
  listActive(): AgentSession[] {
    return this.list().filter(s => s.status === 'running');
  }

  /**
   * 删除会话
   */
  delete(id: string): boolean {
    return this.sessions.delete(id);
  }

  /**
   * 清理已完成的会话（保留最近 N 个）
   */
  cleanup(keepLast: number = 10): void {
    const completed = this.list()
      .filter(s => s.status !== 'running')
      .sort((a, b) => b.updatedAt - a.updatedAt);

    if (completed.length > keepLast) {
      for (const session of completed.slice(keepLast)) {
        this.sessions.delete(session.id);
      }
    }
  }
}

/**
 * 单例
 */
let storeInstance: AgentSessionStore | null = null;

export function getAgentSessionStore(): AgentSessionStore {
  if (!storeInstance) {
    storeInstance = new AgentSessionStore();
  }
  return storeInstance;
}

/**
 * 重置单例（用于测试）
 */
export function resetAgentSessionStore(): void {
  storeInstance = null;
}
