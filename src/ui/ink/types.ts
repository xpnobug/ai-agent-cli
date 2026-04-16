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
  projectFile: string;
  skills: string[];
  agentTypes: string[];
  mascot?: string;
}

/**
 * 当前会话上下文的 token 使用快照
 */
export interface ContextTokenUsage {
  currentTokens: number;
  maxTokens: number;
  percentage: number;
}

/**
 * ContentBlock — 消息内容块
 */
export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string | unknown[]; is_error?: boolean }
  | { type: 'thinking'; thinking: string };

/**
 * 已完成项（消息历史条目）
 * 保留扁平化字段用于渲染，新增可选 content 字段保存完整 ContentBlock 结构
 */
export type CompletedItem =
  | { id: string; type: 'banner'; config: BannerConfig }
  | { id: string; type: 'user_message'; text: string; content?: ContentBlock[] }
  | { id: string; type: 'ai_message'; text: string; elapsed?: number; model?: string; timestamp?: number; content?: ContentBlock[] }
  | { id: string; type: 'thinking'; thinking: string }
  | { id: string; type: 'redacted_thinking' }
  | { id: string; type: 'tool_use'; toolUseId: string; name: string; detail?: string; status: 'done' | 'error'; content?: ContentBlock[] }
  | { id: string; type: 'tool_result'; toolUseId: string; name: string; content: string; isError?: boolean; input?: Record<string, unknown>; contentBlocks?: ContentBlock[] }
  | { id: string; type: 'system'; level: 'success' | 'error' | 'warning' | 'info'; text: string }
  | { id: string; type: 'compact_boundary' }
  | { id: string; type: 'rate_limit'; text: string; retryInSeconds?: number }
  | { id: string; type: 'api_error'; error: string; retryInMs?: number; retryAttempt?: number; maxRetries?: number }
  | { id: string; type: 'user_command'; command: string; args?: string; isSkill?: boolean }
  | { id: string; type: 'user_image'; imageId?: number }
  | { id: string; type: 'bash_input'; command: string }
  | { id: string; type: 'bash_output'; stdout?: string; stderr?: string }
  | { id: string; type: 'divider' }
  | { id: string; type: 'user_plan'; planContent: string }
  | { id: string; type: 'plan_approval'; planContent: string; planFilePath?: string; approved?: boolean }
  | { id: string; type: 'shutdown'; message?: string }
  | { id: string; type: 'hook_progress'; hookName: string; status: 'running' | 'done' | 'error'; message?: string; elapsed?: number }
  | { id: string; type: 'local_command_output'; stdout?: string; stderr?: string; commandName?: string }
  | { id: string; type: 'memory_input'; text: string; filePath?: string };

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
    }
  | {
      type: 'quick_open';
      workdir: string;
      onInsert: (text: string) => void;
    }
  | {
      type: 'global_search';
      workdir: string;
      onInsert: (text: string) => void;
    }
  | {
      type: 'help_panel';
      commands: { name: string; description: string; isHidden?: boolean }[];
      resolve: () => void;
    }
  | {
      type: 'settings_panel';
      config: {
        provider: string;
        model: string;
        apiKeySet: boolean;
        workdir: string;
        permissionMode?: string;
      };
      usage?: {
        totalTokens: number;
        totalCost: number;
        sessionDuration: number;
        turns: number;
      };
      resolve: () => void;
    }
  | {
      type: 'export_dialog';
      resolve: (format: string | null) => void;
    }
  | {
      type: 'model_picker';
      currentModel: string;
      provider: string;
      resolve: (model: string | null) => void;
    }
  | {
      type: 'theme_picker';
      resolve: (theme: string | null) => void;
    }
  | {
      type: 'config_set';
      currentProvider: string;
      currentModel: string;
      resolve: (config: { provider: string; apiKey: string; model: string } | null) => void;
    }
  | {
      type: 'mascot_picker';
      currentMascot: string;
      resolve: (mascotId: string | null) => void;
    }
  | {
      type: 'stats_panel';
      data: {
        totalTokens: number;
        totalCost: number;
        turns: number;
        toolCalls: number;
        durationSeconds: number;
        model: string;
        provider: string;
      };
      resolve: () => void;
    }
  | {
      type: 'diagnostics';
      checks: { name: string; status: 'pass' | 'warn' | 'fail' | 'skip'; message?: string; detail?: string }[];
      resolve: () => void;
    }
  | {
      type: 'message_selector';
      resolve: (index: number | null) => void;
    }
  | {
      type: 'output_style_picker';
      currentStyle: string;
      resolve: (style: string | null) => void;
    }
  | {
      type: 'language_picker';
      currentLanguage: string;
      resolve: (lang: string | null) => void;
    }
  | {
      type: 'log_selector';
      currentLevel: string;
      resolve: (level: string | null) => void;
    };

/**
 * 不含 id 的 CompletedItem 创建类型
 */
export type CompletedItemInput =
  | { type: 'banner'; config: BannerConfig }
  | { type: 'user_message'; text: string; content?: ContentBlock[] }
  | { type: 'ai_message'; text: string; elapsed?: number; model?: string; timestamp?: number; content?: ContentBlock[] }
  | { type: 'thinking'; thinking: string }
  | { type: 'redacted_thinking' }
  | { type: 'tool_use'; toolUseId: string; name: string; detail?: string; status: 'done' | 'error'; content?: ContentBlock[] }
  | { type: 'tool_result'; toolUseId: string; name: string; content: string; isError?: boolean; input?: Record<string, unknown>; contentBlocks?: ContentBlock[] }
  | { type: 'system'; level: 'success' | 'error' | 'warning' | 'info'; text: string }
  | { type: 'compact_boundary' }
  | { type: 'rate_limit'; text: string; retryInSeconds?: number }
  | { type: 'api_error'; error: string; retryInMs?: number; retryAttempt?: number; maxRetries?: number }
  | { type: 'user_command'; command: string; args?: string; isSkill?: boolean }
  | { type: 'user_image'; imageId?: number }
  | { type: 'bash_input'; command: string }
  | { type: 'bash_output'; stdout?: string; stderr?: string }
  | { type: 'divider' }
  | { type: 'user_plan'; planContent: string }
  | { type: 'plan_approval'; planContent: string; planFilePath?: string; approved?: boolean }
  | { type: 'shutdown'; message?: string }
  | { type: 'hook_progress'; hookName: string; status: 'running' | 'done' | 'error'; message?: string; elapsed?: number }
  | { type: 'local_command_output'; stdout?: string; stderr?: string; commandName?: string }
  | { type: 'memory_input'; text: string; filePath?: string };

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
