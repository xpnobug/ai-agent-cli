/**
 * Agent 类型注册表
 * 定义不同类型子代理的配置，包括工具权限、系统提示词等
 */

import type { AgentType } from './types.js';
import { loadPromptWithVars } from '../services/promptLoader.js';

/**
 * Agent 配置
 */
export interface AgentConfig {
  description: string;
  tools: string[] | '*';
  systemPrompt: string;
  maxTurns?: number;
  maxTokens?: number;
  model?: string;
  canResume?: boolean;
  canRunInBackground?: boolean;
}

/**
 * Agent 类型注册表
 */
export const AGENT_TYPES: Record<AgentType, AgentConfig> = {
  explore: {
    description: '只读探索代理，用于搜索和分析代码库',
    tools: ['bash', 'read_file', 'Glob', 'Grep'],
    maxTurns: 10,
    maxTokens: 4096,
    canResume: true,
    canRunInBackground: true,
    systemPrompt: loadPromptWithVars('agent/explore.md', {}),
  },
  code: {
    description: '完整权限代理，用于实现功能和修复 bug',
    tools: '*',
    maxTurns: 15,
    maxTokens: 8192,
    canResume: true,
    canRunInBackground: true,
    systemPrompt: loadPromptWithVars('agent/code.md', {}),
  },
  plan: {
    description: '规划代理，用于设计实施策略',
    tools: ['bash', 'read_file', 'Glob', 'Grep'],
    maxTurns: 8,
    maxTokens: 4096,
    canResume: false,
    canRunInBackground: false,
    systemPrompt: loadPromptWithVars('agent/plan.md', {}),
  },
  bash: {
    description: '命令执行代理，仅运行 bash 命令',
    tools: ['bash', 'read_file'],
    maxTurns: 5,
    maxTokens: 4096,
    canResume: false,
    canRunInBackground: true,
    systemPrompt: loadPromptWithVars('agent/bash.md', {}),
  },
  guide: {
    description: '文档指南代理，用于查找文档和指南',
    tools: ['read_file', 'Glob', 'Grep'],
    maxTurns: 8,
    maxTokens: 4096,
    model: 'fast',
    canResume: false,
    canRunInBackground: false,
    systemPrompt: loadPromptWithVars('agent/guide.md', {}),
  },
  general: {
    description: '通用代理，拥有全部工具权限',
    tools: '*',
    maxTurns: 20,
    maxTokens: 8192,
    canResume: true,
    canRunInBackground: true,
    systemPrompt: loadPromptWithVars('agent/general.md', {}),
  },
};

/**
 * 获取 Agent 类型描述（用于系统提示词和 Task 工具）
 */
export function getAgentTypeDescriptions(): string {
  return Object.entries(AGENT_TYPES)
    .map(([name, config]) => `- **${name}**: ${config.description}`)
    .join('\n');
}

/**
 * 获取 Agent 配置
 */
export function getAgentConfig(agentType: AgentType): AgentConfig {
  return AGENT_TYPES[agentType];
}

/**
 * 获取所有 Agent 类型名称
 */
export function getAgentTypeNames(): AgentType[] {
  return Object.keys(AGENT_TYPES) as AgentType[];
}
