/**
 * InkUIController - 通过 AppStore 驱动 Ink UI
 *
 * 使用正交状态（loading/streaming/focus）替代互斥的 AppPhase。
 */

import type { UIController } from '../UIController.js';
import type { AgentEvent } from '../../core/agentEvent.js';
import type { AppStore } from './store.js';
import { isMarkdownContent } from '../markdown.js';
import type { TokenTracker } from '../../utils/tokenTracker.js';

/**
 * 基于 Ink + AppStore 的 UI 控制器实现
 */
export class InkUIController implements UIController {
  private store: AppStore;
  private tokenTracker?: TokenTracker;

  // 流式文本批量 flush 相关
  private _streamFlushTimer: ReturnType<typeof setTimeout> | null = null;
  private _currentStreamText = '';

  // 当前工具调用的 detail（在 showToolStart 时保存，showToolResult 时使用）
  private _currentToolDetail?: string;

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
        this.finalizeStream(event.fullText, isMarkdownContent(event.fullText));
        break;

      case 'tool_start':
        this.showToolStart(event.toolName, event.input);
        break;

      case 'tool_result':
        if (event.isError) {
          this.showToolOutput(event.result, { isError: true, maxLines: 5 });
        } else {
          this.showToolResult(event.toolName, event.result);
        }
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

    this.store.addCompleted({
      type: 'ai_message',
      text: fullText,
    });

    this._currentStreamText = '';
    this.store.resetToInput();
  }

  showToolStart(toolName: string, input?: Record<string, unknown>): void {
    // 对 Bash 工具，提取 command 参数作为 detail
    let detail: string | undefined;
    if (input) {
      if (toolName.toLowerCase() === 'bash' && input.command) {
        detail = String(input.command).slice(0, 80);
      } else {
        detail = JSON.stringify(input).slice(0, 50);
      }
    }
    this._currentToolDetail = detail;
    this.store.setLoading({
      mode: 'tool_use',
      startTime: Date.now(),
      toolName,
      toolDetail: detail,
      ...this._getTokenSnapshot(),
    });
  }

  showToolResult(toolName: string, result: string, _input?: Record<string, unknown>): void {
    // 保留多行结果，由 ToolCallView 负责截断展示
    const maxChars = 500;
    const truncated = result.length > maxChars ? result.slice(0, maxChars) : result;
    this.store.addCompleted({
      type: 'tool_call',
      name: toolName,
      detail: this._currentToolDetail,
      result: truncated,
    });
    this._currentToolDetail = undefined;
  }

  showToolOutput(output: string, opts?: { isError?: boolean; maxLines?: number }): void {
    this.store.addCompleted({
      type: 'tool_call',
      name: 'output',
      result: output,
      isError: opts?.isError,
    });
  }

  showToolError(toolName: string, error: string): void {
    this.store.addCompleted({
      type: 'tool_call',
      name: toolName,
      result: error,
      isError: true,
    });
  }

  async requestPermission(
    toolName: string,
    params: Record<string, unknown>,
    reason?: string
  ): Promise<'allow' | 'deny' | 'always'> {
    // 使用内联 focus 对话框替代独立 Ink 实例
    return new Promise((resolve) => {
      this.store.setFocus({
        type: 'permission',
        toolName,
        params,
        reason,
        resolve: (result) => {
          // 用户做出选择后，清除焦点
          this.store.setFocus(undefined);
          resolve(result);
        },
      });
    });
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
    this.store.resetToInput();
  }

  addUserMessage(text: string): void {
    this.store.addCompleted({
      type: 'user_message',
      text,
    });
  }
}
