/**
 * UIController 接口
 * 抽象所有 UI 输出操作，使核心逻辑与具体 UI 实现解耦
 */

import type { PermissionDecision } from '../core/permissions.js';

/**
 * UI 控制器接口
 */
export interface UIController {
  /** 显示思考中动画 */
  showThinking(): void;

  /** 隐藏思考中动画 */
  hideThinking(): void;

  /** 追加流式文本 */
  appendStreamText(text: string): void;

  /** 完成流式输出，渲染最终文本 */
  finalizeStream(fullText: string, isMarkdown: boolean): void;

  /** 显示工具进入队列 */
  showToolQueued(toolName: string, toolUseId: string, input?: Record<string, unknown>): void;

  /** 显示工具开始执行 */
  showToolStart(toolName: string, toolUseId: string, input?: Record<string, unknown>): void;

  /** 显示工具执行结果 */
  showToolResult(toolName: string, toolUseId: string, result: string, isError: boolean): void;

  /** 请求权限确认 */
  requestPermission(
    toolName: string,
    params: Record<string, unknown>,
    reason?: string,
    options?: {
      commandPrefix?: string | null;
      commandInjectionDetected?: boolean;
      destructiveWarning?: string | null;
    }
  ): Promise<PermissionDecision>;

  /** 显示警告消息 */
  showWarning(msg: string): void;

  /** 显示错误消息 */
  showError(msg: string): void;

  /** 显示信息消息 */
  showInfo(msg: string): void;

  /** 显示重试提示 */
  showRetry(attempt: number, max: number, delay: number, error: string): void;

  /** 清除已输出的流式文本（用于重试/markdown 替换） */
  clearStreamedText(lineCount: number): void;
}
