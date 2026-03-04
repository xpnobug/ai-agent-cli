/**
 * InkUIController - 通过 AppStore 驱动 Ink UI
 *
 * 使用正交状态（loading/streaming/focus）替代互斥的 AppPhase。
 */

import path from 'node:path';
import type { UIController } from '../UIController.js';
import type { AgentEvent } from '../../core/agentEvent.js';
import type { AppStore } from './store.js';
import type { AskUserQuestionDef, AskUserQuestionResult } from './types.js';
import { generateId } from './types.js';
import type { TokenTracker } from '../../utils/tokenTracker.js';
import { setRequestStatus } from './requestStatus.js';
import type { Message, ContentBlock } from '../../core/types.js';
import type { SessionListItem } from '../../services/session/sessionResume.js';
import type { TaskListItem } from '../../services/session/taskList.js';

/**
 * 基于 Ink + AppStore 的 UI 控制器实现
 */
export class InkUIController implements UIController {
  private store: AppStore;
  private tokenTracker?: TokenTracker;
  private toolInputById = new Map<string, Record<string, unknown>>();
  private hasMarkedStreaming = false;

  // 流式文本批量 flush 相关
  private _streamFlushTimer: ReturnType<typeof setTimeout> | null = null;
  private _currentStreamText = '';


  constructor(store: AppStore, tokenTracker?: TokenTracker) {
    this.store = store;
    this.tokenTracker = tokenTracker;
  }

  getStore(): AppStore {
    return this.store;
  }

  /**
   * 获取当前 token 快照（tokenCount + costUSD）
   */
  private _getTokenSnapshot(): { tokenCount?: number; costUSD?: number } {
    if (!this.tokenTracker) return {};
    const stats = this.tokenTracker.getStats();
    return {
      tokenCount: stats.totalTokens || undefined,
      costUSD: stats.totalCost || undefined,
    };
  }

  /**
   * 处理 AgentEvent — generator 事件驱动入口
   */
  async handleEvent(event: AgentEvent): Promise<void> {
    switch (event.type) {
      case 'thinking_start':
        this.showThinking();
        break;

      case 'thinking_stop':
        this.hideThinking();
        break;

      case 'stream_text':
        this.appendStreamText(event.text);
        break;

      case 'stream_done':
        this.finalizeStream(event.fullText, false);
        break;

      case 'tool_start':
        this.showToolStart(event.toolName, event.toolUseId, event.input);
        break;

      case 'tool_result':
        this.showToolResult(event.toolName, event.toolUseId, event.result, event.isError);
        break;

      case 'tool_queued':
        this.showToolQueued(event.toolName, event.toolUseId, event.input);
        break;
      case 'permission_request': {
        const result = await this.requestPermission(
          event.toolName,
          event.params,
          event.reason
        );
        event.resolve(result);
        break;
      }

      case 'retry':
        this.showRetry(event.attempt, event.maxAttempts, event.delay, event.error);
        this.showThinking();
        break;

      case 'error':
        this.showError(event.message);
        break;

      case 'info':
        this.showInfo(event.message);
        break;

      case 'warning':
        this.showWarning(event.message);
        break;

      case 'turn_complete':
        // 由调用者处理
        break;
    }
  }

  showThinking(): void {
    this.hasMarkedStreaming = false;
    setRequestStatus({ kind: 'thinking' });
    // 清除上一轮可能残留的流式状态
    if (this._currentStreamText || this._streamFlushTimer) {
      if (this._streamFlushTimer) {
        clearTimeout(this._streamFlushTimer);
        this._streamFlushTimer = null;
      }
      this._currentStreamText = '';
      this.store.setStreaming(null);
    }

    this.store.setLoading({
      mode: 'thinking',
      startTime: Date.now(),
      ...this._getTokenSnapshot(),
    });
  }

  hideThinking(): void {
    // 不立即清除 loading，等待后续状态设置（如 streaming 或 tool_use）
  }

  appendStreamText(text: string): void {
    this._currentStreamText += text;
    if (!this.hasMarkedStreaming) {
      setRequestStatus({ kind: 'streaming' });
      this.hasMarkedStreaming = true;
    }

    // 16ms 批量 flush 避免频繁重渲染
    if (!this._streamFlushTimer) {
      this._streamFlushTimer = setTimeout(() => {
        this._flushStream();
      }, 16);
    }
  }

  private _flushStream(): void {
    this._streamFlushTimer = null;
    // 进入流式状态时清除 loading
    this.store.setLoading(null);
    this.store.setStreaming({ text: this._currentStreamText });
  }

  clearStreamedText(_lineCount: number): void {
    this._currentStreamText = '';
    if (this._streamFlushTimer) {
      clearTimeout(this._streamFlushTimer);
      this._streamFlushTimer = null;
    }
    this.store.setStreaming(null);
  }

  finalizeStream(fullText: string, _isMarkdown: boolean): void {
    if (this._streamFlushTimer) {
      clearTimeout(this._streamFlushTimer);
      this._streamFlushTimer = null;
    }

    this._currentStreamText = '';

    // 原子操作：同时添加完成项并清除流式状态
    // 避免两次 setState 导致中间帧 Static 和 StreamingText 同时渲染
    this.store.addCompletedAndReset({
      type: 'ai_message',
      text: fullText,
    });
  }

  showToolQueued(toolName: string, toolUseId: string, input?: Record<string, unknown>): void {
    const detail = input ? this._summarizeToolInput(toolName, input) : undefined;
    if (input) {
      this.toolInputById.set(toolUseId, input);
    }
    // 工具进入队列后不再显示全局 spinner
    this.store.setLoading(null);
    const exists = this.store.getState().activeToolUses.some((item) => item.toolUseId === toolUseId);
    if (exists) {
      this.store.updateActiveToolUse(toolUseId, (item) => ({
        ...item,
        name: toolName,
        detail: item.detail || detail,
        status: 'queued',
      }));
      return;
    }
    this.store.addActiveToolUse({
      toolUseId,
      name: toolName,
      detail,
      status: 'queued',
    });
  }

  showToolStart(toolName: string, toolUseId: string, input?: Record<string, unknown>): void {
    const detail = input ? this._summarizeToolInput(toolName, input) : undefined;
    setRequestStatus({ kind: 'tool', detail: toolName });
    if (input && !this.toolInputById.has(toolUseId)) {
      this.toolInputById.set(toolUseId, input);
    }
    this.store.setLoading(null);
    const active = this.store.getState().activeToolUses.find((item) => item.toolUseId === toolUseId);
    if (!active) {
      this.store.addActiveToolUse({
        toolUseId,
        name: toolName,
        detail,
        status: 'running',
      });
      return;
    }
    this.store.updateActiveToolUse(toolUseId, (item) => ({
      ...item,
      name: toolName,
      detail: item.detail || detail,
      status: 'running',
    }));
  }

  /**
   * 从工具输入中提取可读摘要
   *
   * Bash → command
   * 文件操作 → file_path / path
   * 搜索 → pattern / query
   * 数组参数 → "N items"
   */
  private _summarizeToolInput(toolName: string, input: Record<string, unknown>): string {
    // Bash：显示命令
    if (toolName.toLowerCase() === 'bash' && input.command) {
      return String(input.command).slice(0, 80);
    }

    const formatPath = (raw: string): string => {
      const cwd = process.cwd();
      if (path.isAbsolute(raw)) {
        const rel = path.relative(cwd, raw);
        if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) {
          return rel;
        }
      }
      return raw;
    };

    // 文件路径类参数
    for (const key of ['file_path', 'path', 'relative_path']) {
      if (input[key] && typeof input[key] === 'string') {
        return formatPath(String(input[key])).slice(0, 80);
      }
    }

    // 搜索/匹配类参数
    for (const key of ['pattern', 'query', 'glob', 'command']) {
      if (input[key] && typeof input[key] === 'string') {
        return String(input[key]).slice(0, 60);
      }
    }

    // 数组参数 → 显示数量（如 TodoWrite 的 todos）
    for (const [key, value] of Object.entries(input)) {
      if (Array.isArray(value)) {
        return `${value.length} ${key}`;
      }
    }

    // 文本内容类参数
    for (const key of ['content', 'text', 'description']) {
      if (input[key] && typeof input[key] === 'string') {
        return String(input[key]).slice(0, 60);
      }
    }

    // 兜底：key=value 摘要
    const keys = Object.keys(input);
    if (keys.length === 1) {
      const val = input[keys[0]!];
      if (typeof val === 'string') return val.slice(0, 60);
    }
    return keys.join(', ');
  }

  showToolResult(toolName: string, toolUseId: string, result: string, isError: boolean): void {
    // 工具结束：移除活跃状态并追加静态记录
    const active = this.store.getState().activeToolUses.find(
      (item) => item.toolUseId === toolUseId
    );
    const toolInput = this.toolInputById.get(toolUseId);
    this.toolInputById.delete(toolUseId);
    this.store.removeActiveToolUse(toolUseId);

    this.store.addCompleted({
      type: 'tool_use',
      toolUseId,
      name: toolName,
      detail: active?.detail,
      status: isError ? 'error' : 'done',
    });

    this.store.addCompleted({
      type: 'tool_result',
      toolUseId,
      name: toolName,
      content: result,
      isError,
      input: toolInput,
    });
  }

  async requestPermission(
    toolName: string,
    params: Record<string, unknown>,
    reason?: string,
    options?: { commandPrefix?: string | null; commandInjectionDetected?: boolean }
  ): Promise<import('../../core/permissions.js').PermissionDecision> {
    // 使用内联 focus 对话框替代独立 Ink 实例
    return new Promise((resolve) => {
      this.store.setFocus({
        type: 'permission',
        toolName,
        params,
        reason,
        commandPrefix: options?.commandPrefix,
        commandInjectionDetected: options?.commandInjectionDetected,
        resolve: (result) => {
          // 用户做出选择后，清除焦点
          this.store.setFocus(undefined);
          resolve(result);
        },
      });
    });
  }

  async requestQuestion(
    questions: AskUserQuestionDef[],
    initialAnswers?: Record<string, string>
  ): Promise<AskUserQuestionResult | null> {
    return new Promise((resolve) => {
      this.store.setFocus({
        type: 'question',
        questions,
        initialAnswers,
        resolve: (result) => {
          this.store.setFocus(undefined);
          resolve(result);
        },
      });
    });
  }

  /**
   * 请求会话选择（/resume）
   */
  async requestSessionResume(sessions: SessionListItem[]): Promise<number | null> {
    return new Promise((resolve) => {
      this.store.setFocus({
        type: 'session_selector',
        sessions,
        resolve: (result) => {
          this.store.setFocus(undefined);
          resolve(result);
        },
      });
    });
  }

  /**
   * 请求任务选择（/tasks）
   */
  async requestTaskManager(tasks: TaskListItem[]): Promise<{ action: 'output' | 'stop'; taskId: string } | null> {
    return new Promise((resolve) => {
      this.store.setFocus({
        type: 'task_selector',
        tasks,
        resolve: (result) => {
          this.store.setFocus(undefined);
          resolve(result);
        },
      });
    });
  }

  /**
   * 直接记录命令触发的工具结果（不走 AgentEvent）
   */
  showToolResultFromCommand(
    toolName: string,
    input: Record<string, unknown>,
    result: string,
    isError: boolean
  ): void {
    const toolUseId = `cmd_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const detail = input ? this._summarizeToolInput(toolName, input) : undefined;
    if (input) {
      this.toolInputById.set(toolUseId, input);
    }
    this.store.addCompleted({
      type: 'tool_use',
      toolUseId,
      name: toolName,
      detail,
      status: isError ? 'error' : 'done',
    });
    this.store.addCompleted({
      type: 'tool_result',
      toolUseId,
      name: toolName,
      content: result,
      isError,
      input,
    });
  }

  /**
   * 用历史消息重新渲染 UI（用于恢复会话）
   */
  hydrateHistory(messages: Message[]): void {
    const bannerItems = this.store.getState().completedItems.filter((item) => item.type === 'banner');
    const completedInputs = messages
      .map((msg) => this._messageToCompletedItem(msg))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    const completed = completedInputs.map((item) => ({
      ...item,
      id: generateId(),
    }));

    this.toolInputById.clear();
    this.hasMarkedStreaming = false;
    this._currentStreamText = '';
    if (this._streamFlushTimer) {
      clearTimeout(this._streamFlushTimer);
      this._streamFlushTimer = null;
    }

    this.store.setState(() => ({
      completedItems: [...bannerItems, ...completed],
      activeToolUses: [],
      loading: null,
      streaming: null,
      focus: undefined,
    }));
  }

  private _messageToCompletedItem(message: Message) {
    if (message.role !== 'user' && message.role !== 'assistant') return null;
    if (this._isToolResultOnly(message.content)) return null;
    const text = this._messageContentToText(message.content);
    if (!text) return null;
    return message.role === 'user'
      ? { type: 'user_message' as const, text }
      : { type: 'ai_message' as const, text };
  }

  private _messageContentToText(content: string | ContentBlock[]): string {
    if (typeof content === 'string') return content;
    return content
      .filter((block) => block.type === 'text')
      .map((block) => ('text' in block ? block.text : ''))
      .join('\n\n')
      .trim();
  }

  private _isToolResultOnly(content: string | ContentBlock[]): boolean {
    if (typeof content === 'string') return false;
    if (content.length === 0) return false;
    return content.every((block) => block.type === 'tool_result');
  }

  showWarning(msg: string): void {
    this.store.addCompleted({
      type: 'system',
      level: 'warning',
      text: msg,
    });
  }

  showError(msg: string): void {
    this.store.addCompleted({
      type: 'system',
      level: 'error',
      text: msg,
    });
  }

  showInfo(msg: string): void {
    this.store.addCompleted({
      type: 'system',
      level: 'info',
      text: msg,
    });
  }

  showRetry(attempt: number, max: number, delay: number, error: string): void {
    this.store.addCompleted({
      type: 'system',
      level: 'warning',
      text: `API 请求失败，${(delay / 1000).toFixed(1)}秒后重试 (${attempt}/${max})... [${error}]`,
    });
  }

  goToInput(): void {
    setRequestStatus({ kind: 'idle' });
    this.store.resetToInput();
  }

  addUserMessage(text: string): void {
    this.store.addCompleted({
      type: 'user_message',
      text,
    });
  }
}
