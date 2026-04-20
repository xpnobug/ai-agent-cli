/**
 * AgentEvent — 代理循环事件流类型定义
 *
 * Generator 版 agentLoop 产出的事件联合类型，
 * 彻底解耦业务逻辑与 UI 渲染。
 */

import type { Message } from './types.js';
import type { PermissionDecision } from './permissions.js';

export type AgentEvent =
  | { type: 'thinking_start' }
  | { type: 'thinking_stop' }
  | { type: 'stream_text'; text: string }
  | { type: 'stream_done'; fullText: string }
  | { type: 'tool_queued'; toolUseId: string; toolName: string; input: Record<string, unknown> }
  | { type: 'tool_start'; toolUseId: string; toolName: string; input: Record<string, unknown> }
  | {
      type: 'tool_result';
      toolUseId: string;
      toolName: string;
      result: string;
      isError: boolean;
      rawOutput?: Record<string, unknown>;
      terminalId?: string;
    }
  | {
      type: 'permission_request';
      toolUseId: string;
      toolName: string;
      params: Record<string, unknown>;
      reason?: string;
      commandPrefix?: string | null;
      commandInjectionDetected?: boolean;
      /** 命中危险命令模式时的中文警告（仅 UI 展示，不影响权限决策） */
      destructiveWarning?: string | null;
      resolve: (r: PermissionDecision) => void;
    }
  | { type: 'retry'; attempt: number; maxAttempts: number; delay: number; error: string }
  | { type: 'error'; message: string }
  | { type: 'info'; message: string }
  | { type: 'warning'; message: string }
  | { type: 'turn_complete'; history: Message[] };
