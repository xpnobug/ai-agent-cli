/**
 * 系统提示词生成 - 模块化设计（文件化模板）
 */

import { getAgentTypeDescriptions, getAgentConfig } from './agents.js';
import type { AgentType } from './types.js';
import { PROJECT_FILE, PRODUCT_NAME } from './constants.js';
import { loadPromptWithVars } from '../services/promptLoader.js';
import {
  getCurrentOutputStyle as getCurrentOutputStyleFromRegistry,
  getOutputStylePrompt,
  setCurrentOutputStyle,
  type OutputStyleName,
} from './outputStyles.js';

export function getCurrentOutputStyle(): OutputStyleName {
  return getCurrentOutputStyleFromRegistry();
}

export function setOutputStyle(style: OutputStyleName): void {
  setCurrentOutputStyle(style);
}

/**
 * 获取环境信息
 */
export function getEnvInfo(workdir: string): string {
  return `<env>
工作目录: ${workdir}
操作系统: ${process.platform}
Node版本: ${process.version}
当前日期: ${new Date().toLocaleDateString('zh-CN')}
</env>`;
}

function getSystemPromptSections(workdir: string): string[] {
  return [
    loadPromptWithVars('system/identity.md', { productName: PRODUCT_NAME }),
    loadPromptWithVars('system/security.md', {}),
    loadPromptWithVars('system/task-management.md', {}),
    loadPromptWithVars('system/memory.md', { projectFile: PROJECT_FILE }),
    ...(getCurrentOutputStyle() === 'default'
      ? [loadPromptWithVars('system/tone-default.md', {})]
      : []),
    loadPromptWithVars('system/proactiveness.md', {}),
    loadPromptWithVars('system/code-conventions.md', {}),
    ...(getCurrentOutputStyle() === 'default' || getCurrentOutputStyle() === 'explanatory'
      ? [loadPromptWithVars('system/workflow.md', {})]
      : []),
    loadPromptWithVars('system/tool-usage.md', {}),
    getEnvInfo(workdir),
  ];
}

/**
 * 创建系统提示词（模块化组合）
 */
export function createSystemPrompt(
  workdir: string,
  skillDescriptions: string,
  agentDescriptions: string
): string {
  const sections = [
    ...getSystemPromptSections(workdir),
    `## 可用技能\n\n${skillDescriptions}`,
    `## 子代理类型\n\n${agentDescriptions}`,
  ];

  const outputStylePrompt = getOutputStylePrompt();
  if (outputStylePrompt) {
    sections.push(outputStylePrompt);
  }

  // 与旧行为保持一致：末尾再次强化安全约束
  sections.push(loadPromptWithVars('system/security.md', {}));

  return sections.filter(Boolean).join('\n\n');
}

/**
 * 创建子代理的系统提示词
 */
export function createSubagentSystemPrompt(
  workdir: string,
  agentType: AgentType,
  taskDescription: string
): string {
  const config = getAgentConfig(agentType);
  return loadPromptWithVars('system/subagent-wrapper.md', {
    agentSystemPrompt: config.systemPrompt,
    taskDescription,
    envInfo: getEnvInfo(workdir),
  });
}

/**
 * 获取代理类型描述（用于系统提示词）
 */
export function getAgentDescriptions(): string {
  return getAgentTypeDescriptions();
}
