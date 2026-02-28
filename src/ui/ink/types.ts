/**
 * Ink UI 类型定义
 */

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
  | { id: string; type: 'tool_call'; name: string; detail?: string; result?: string; isError?: boolean }
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

/** 流式文本状态 */
export type StreamingState = {
  text: string;
} | null;

/** 焦点目标 */
export type FocusTarget =
  | undefined // 显示输入框
  | { type: 'permission'; toolName: string; params: Record<string, unknown>; reason?: string; resolve: (r: 'allow' | 'deny' | 'always') => void }
  | { type: 'question'; questions: unknown[]; resolve: (r: string) => void };

/**
 * 不含 id 的 CompletedItem 创建类型
 */
export type CompletedItemInput =
  | { type: 'banner'; config: BannerConfig }
  | { type: 'user_message'; text: string }
  | { type: 'ai_message'; text: string; elapsed?: number }
  | { type: 'tool_call'; name: string; detail?: string; result?: string; isError?: boolean }
  | { type: 'system'; level: 'success' | 'error' | 'warning' | 'info'; text: string }
  | { type: 'divider' };

/**
 * 生成唯一 ID
 */
let _idCounter = 0;
export function generateId(): string {
  return `item-${++_idCounter}-${Date.now()}`;
}
