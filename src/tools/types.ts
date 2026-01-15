/**
 * 工具类型定义
 */

import type { AgentType } from '../core/types.js';

// Todo 项
export interface TodoItem {
  id?: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm: string;
}

// Bash 工具输入
export interface BashInput {
  command: string;
}

// 文件读取输入
export interface ReadFileInput {
  path: string;
  limit?: number;
}

// 文件写入输入
export interface WriteFileInput {
  path: string;
  content: string;
}

// 文件编辑输入
export interface EditFileInput {
  path: string;
  old_text: string;
  new_text: string;
}

// Todo 工具输入
export interface TodoWriteInput {
  todos: TodoItem[];
}

// 技能工具输入
export interface SkillInput {
  skill: string;
  args?: string;  // 新增：可选参数
}

// 任务工具输入
export interface TaskInput {
  description: string;
  prompt: string;
  agent_type: AgentType;
}

// 工具输入联合类型
export type ToolInput =
  | BashInput
  | ReadFileInput
  | WriteFileInput
  | EditFileInput
  | TodoWriteInput
  | SkillInput
  | TaskInput;

// ============================================================
// 技能系统类型定义 (Production-grade, 对标 Kode-cli)
// ============================================================

/**
 * 技能来源
 */
export type SkillSource = 'localSettings' | 'userSettings' | 'pluginDir';

/**
 * 技能作用域
 */
export type SkillScope = 'user' | 'project';

/**
 * 技能 Frontmatter 完整定义
 * 对应 SKILL.md 或 command.md 文件的 YAML frontmatter
 */
export interface SkillFrontmatter {
  name?: string;
  description?: string;
  aliases?: string[];
  'allowed-tools'?: string[] | string;
  'argument-hint'?: string;
  when_to_use?: string;
  version?: string;
  model?: 'haiku' | 'sonnet' | 'opus' | 'inherit' | string;
  'max-thinking-tokens'?: number | string;
  max_thinking_tokens?: number | string;
  maxThinkingTokens?: number | string;
  'disable-model-invocation'?: boolean | string;
  enabled?: boolean;
  hidden?: boolean;
  progressMessage?: string;
  argNames?: string[];
}

/**
 * 技能元数据（Layer 1）
 */
export interface SkillMetadata {
  name: string;
  description: string;
  aliases?: string[];
  argumentHint?: string;
  whenToUse?: string;
  version?: string;
}

/**
 * 完整技能定义 (Production-grade)
 * 对标 Kode-cli 的 CustomCommandWithScope
 */
export interface Skill extends SkillMetadata {
  type: 'prompt';
  body: string;
  path: string;
  dir: string;

  // 状态
  isEnabled: boolean;
  isHidden: boolean;
  isSkill: boolean;            // 是否为技能（vs 普通命令）

  // 高级配置
  allowedTools?: string[];     // 工具白名单
  model?: string;              // 指定模型 (haiku/sonnet/opus)
  maxThinkingTokens?: number;  // 最大思考 token
  progressMessage?: string;    // 进度消息

  // AI 调用控制
  disableModelInvocation?: boolean;  // 禁止 AI 自动调用
  hasUserSpecifiedDescription?: boolean;

  // 来源信息
  source?: SkillSource;
  scope?: SkillScope;

  /**
   * 获取用户可见的名称
   */
  userFacingName(): string;

  /**
   * 获取带参数替换的 Prompt
   * @param args 用户传入的参数
   */
  getPromptForCommand(args: string): Promise<string>;
}

/**
 * 技能执行结果
 */
export interface SkillResult {
  success: boolean;
  commandName: string;
  error?: string;
  prompt?: string;
  allowedTools?: string[];
  model?: string;
  maxThinkingTokens?: number;
}

/**
 * 已安装的技能插件信息
 */
export interface InstalledSkillPlugin {
  plugin: string;
  marketplace: string;
  scope: SkillScope;
  kind?: 'skill-pack' | 'plugin-pack';
  isEnabled?: boolean;
  projectPath?: string;
  installedAt: string;
  pluginRoot?: string;
  skills: string[];
  commands: string[];
  sourceMarketplacePath: string;
}
