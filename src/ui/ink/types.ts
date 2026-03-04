/**
 * Ink UI 类型定义
 */

import type { PermissionDecision } from '../../core/permissions.js';
import type { SessionListItem } from '../../services/session/sessionResume.js';
import type { TaskListItem } from '../../services/session/taskList.js';

/**
 * Banner 配置接口
 */
export interface BannerConfig {
  provider: string;
  providerDisplayName: string;
  model: string;
  workdir: string;
  skills: string[];
  agentTypes: string[];
}

/**
 * 已完成项（固定到 Static 区域的历史条目）
 */
export type CompletedItem =
  | { id: string; type: 'banner'; config: BannerConfig }
  | { id: string; type: 'user_message'; text: string }
  | { id: string; type: 'ai_message'; text: string; elapsed?: number }
  | { id: string; type: 'tool_use'; toolUseId: string; name: string; detail?: string; status: 'done' | 'error' }
  | { id: string; type: 'tool_result'; toolUseId: string; name: string; content: string; isError?: boolean; input?: Record<string, unknown> }
  | { id: string; type: 'system'; level: 'success' | 'error' | 'warning' | 'info'; text: string }
  | { id: string; type: 'divider' };

/**
 * 应用阶段（活跃区域显示状态）
 * @deprecated 由 loading/streaming/focus 三个正交状态替代
 */
export type AppPhase =
  | { type: 'input' }
  | { type: 'thinking' }
  | { type: 'streaming'; text: string }
  | { type: 'tool_active'; name: string; detail?: string }
  | {
      type: 'question';
      questions: unknown[];
      resolve: (r: string) => void;
    };

// ─── 正交状态类型 ───

/** Spinner 模式 */
export type LoadingMode = 'thinking' | 'tool_use' | 'requesting';

/** 加载状态 */
export type LoadingState = {
  mode: LoadingMode;
  startTime: number;
  toolName?: string;
  toolDetail?: string;
  tokenCount?: number;
  costUSD?: number;
} | null;

// ─── AskUserQuestion 类型 ───

export type AskUserQuestionOption = {
  label: string;
  description: string;
};

export type AskUserQuestionDef = {
  question: string;
  header: string;
  options: AskUserQuestionOption[];
  multiSelect?: boolean;
};

export type AskUserQuestionResult = {
  answers: Record<string, string>;
};

/** 流式文本状态 */
export type StreamingState = {
  text: string;
} | null;

/** 焦点目标 */
export type FocusTarget =
  | undefined // 显示输入框
  | {
      type: 'permission';
      toolName: string;
      params: Record<string, unknown>;
      reason?: string;
      commandPrefix?: string | null;
      commandInjectionDetected?: boolean;
      resolve: (r: PermissionDecision) => void;
    }
  | {
      type: 'question';
      questions: AskUserQuestionDef[];
      initialAnswers?: Record<string, string>;
      resolve: (r: AskUserQuestionResult | null) => void;
    }
  | {
      type: 'session_selector';
      sessions: SessionListItem[];
      resolve: (r: number | null) => void;
    }
  | {
      type: 'task_selector';
      tasks: TaskListItem[];
      resolve: (r: { action: 'output' | 'stop'; taskId: string } | null) => void;
    };

/**
 * 不含 id 的 CompletedItem 创建类型
 */
export type CompletedItemInput =
  | { type: 'banner'; config: BannerConfig }
  | { type: 'user_message'; text: string }
  | { type: 'ai_message'; text: string; elapsed?: number }
  | { type: 'tool_use'; toolUseId: string; name: string; detail?: string; status: 'done' | 'error' }
  | { type: 'tool_result'; toolUseId: string; name: string; content: string; isError?: boolean; input?: Record<string, unknown> }
  | { type: 'system'; level: 'success' | 'error' | 'warning' | 'info'; text: string }
  | { type: 'divider' };

/** 活跃中的工具调用（非 Static，允许动画与状态更新） */
export type ActiveToolUse = {
  toolUseId: string;
  name: string;
  detail?: string;
  status: 'queued' | 'running';
};

/**
 * 生成唯一 ID
 */
let _idCounter = 0;
export function generateId(): string {
  return `item-${++_idCounter}-${Date.now()}`;
}
