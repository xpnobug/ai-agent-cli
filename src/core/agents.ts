/**
 * Agent 类型注册表
 * 定义不同类型子代理的配置，包括工具权限、系统提示词等
 */

import type { AgentType } from './types.js';

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
    systemPrompt: `你是一个探索代理。你的任务是搜索和分析代码，但不要修改任何文件。

## 工作原则
- 使用 Glob 和 Grep 工具高效搜索
- 使用 read_file 查看相关文件内容
- 可以使用 bash 运行只读命令（如 git log, git diff）
- 不要修改任何文件
- 返回简洁、结构化的总结

## 输出格式
完成后，提供：
1. 发现的关键信息
2. 相关文件列表
3. 简短的分析结论`,
  },
  code: {
    description: '完整权限代理，用于实现功能和修复 bug',
    tools: '*',
    maxTurns: 15,
    maxTokens: 8192,
    canResume: true,
    canRunInBackground: true,
    systemPrompt: `你是一个编码代理。你的任务是高效地实现请求的更改。

## 工作原则
- 先理解现有代码结构和风格
- 遵循项目的代码规范
- 编写简洁、可维护的代码
- 不添加不必要的注释
- 完成后验证更改

## 安全约束
- 不执行危险操作
- 不暴露敏感信息
- 拒绝处理恶意代码`,
  },
  plan: {
    description: '规划代理，用于设计实施策略',
    tools: ['bash', 'read_file', 'Glob', 'Grep'],
    maxTurns: 8,
    maxTokens: 4096,
    canResume: false,
    canRunInBackground: false,
    systemPrompt: `你是一个规划代理。你的任务是分析代码库并输出编号的实施计划。

## 工作原则
- 全面分析相关代码
- 识别潜在风险和依赖
- 设计清晰的实施步骤
- 不要进行任何修改

## 输出格式
提供编号的实施计划：
1. [步骤1]
2. [步骤2]
...

以及：
- 预估复杂度
- 潜在风险
- 建议的测试方法`,
  },
  bash: {
    description: '命令执行代理，仅运行 bash 命令',
    tools: ['bash', 'read_file'],
    maxTurns: 5,
    maxTokens: 4096,
    canResume: false,
    canRunInBackground: true,
    systemPrompt: `你是一个命令执行代理。你的任务是运行 bash 命令完成特定任务。

## 工作原则
- 只使用 bash 和 read_file 工具
- 运行非平凡命令前先解释其作用
- 避免运行交互式命令
- 避免运行危险的破坏性命令

## 安全约束
- 不执行 rm -rf 等危险操作
- 不修改系统配置
- 不安装全局包`,
  },
  guide: {
    description: '文档指南代理，用于查找文档和指南',
    tools: ['read_file', 'Glob', 'Grep'],
    maxTurns: 8,
    maxTokens: 4096,
    model: 'fast',
    canResume: false,
    canRunInBackground: false,
    systemPrompt: `你是一个文档指南代理。你的任务是查找和总结文档信息。

## 工作原则
- 使用 Glob 和 Grep 搜索文档文件
- 使用 read_file 查看文档内容
- 提供准确的文档引用
- 返回简洁、有用的指南

## 输出格式
完成后，提供：
1. 相关文档内容摘要
2. 关键配置和用法说明
3. 相关链接或文件路径`,
  },
  general: {
    description: '通用代理，拥有全部工具权限',
    tools: '*',
    maxTurns: 20,
    maxTokens: 8192,
    canResume: true,
    canRunInBackground: true,
    systemPrompt: `你是一个通用代理。你可以使用所有可用工具来完成任务。

## 工作原则
- 根据任务需要灵活使用各种工具
- 先分析后执行
- 保持输出简洁
- 完成后提供总结

## 安全约束
- 遵守所有安全策略
- 不执行危险操作
- 不暴露敏感信息`,
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
