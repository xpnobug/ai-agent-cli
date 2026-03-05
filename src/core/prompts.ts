/**
 * 系统提示词生成 - 模块化设计（文件化模板）
 */

import { getAgentTypeDescriptions, getAgentByType } from './agents.js';
import type { AgentType } from './types.js';
import { PROJECT_FILE, PRODUCT_NAME, PROJECT_DIR } from './constants.js';
import { loadPromptWithVars } from '../services/promptLoader.js';
import { getSessionId } from '../services/session/sessionId.js';
import fs from 'fs-extra';
import path from 'node:path';
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

function getScratchpadDir(workdir: string): string {
  const sessionId = getSessionId();
  return path.join(workdir, PROJECT_DIR, 'scratchpad', sessionId);
}

function getScratchpadInfo(workdir: string): string {
  const scratchpadDir = getScratchpadDir(workdir);
  return loadPromptWithVars('system/scratchpad.md', { scratchpadDir });
}

function loadClaudeInstructions(workdir: string, projectFile: string): string | null {
  const filePath = path.join(workdir, projectFile);
  if (!fs.existsSync(filePath)) return null;
  try {
    const content = fs.readFileSync(filePath, 'utf8').trim();
    if (!content) return null;
    const header = loadPromptWithVars('system/claude-instructions-header.md', {});
    return `${header}\n\n${content}`;
  } catch {
    return null;
  }
}

function getSystemPromptSections(workdir: string, projectFile: string): string[] {
  const claudeInstructions = loadClaudeInstructions(workdir, projectFile);
  return [
    loadPromptWithVars('system/identity.md', { productName: PRODUCT_NAME }),
    ...(claudeInstructions ? [claudeInstructions] : []),
    loadPromptWithVars('system/security.md', {}),
    loadPromptWithVars('system/task-management.md', {}),
    loadPromptWithVars('system/memory.md', { projectFile }),
    ...(getCurrentOutputStyle() === 'default'
      ? [loadPromptWithVars('system/tone-default.md', {})]
      : []),
    loadPromptWithVars('system/proactiveness.md', {}),
    loadPromptWithVars('system/code-conventions.md', {}),
    ...(getCurrentOutputStyle() === 'default' || getCurrentOutputStyle() === 'explanatory'
      ? [loadPromptWithVars('system/workflow.md', {})]
      : []),
    loadPromptWithVars('system/tool-usage.md', {}),
    getScratchpadInfo(workdir),
    getEnvInfo(workdir),
  ];
}

/**
 * 创建系统提示词（模块化组合）
 */
export function createSystemPrompt(
  workdir: string,
  skillDescriptions: string,
  agentDescriptions: string,
  options?: { projectFile?: string }
): string {
  const projectFile = options?.projectFile || PROJECT_FILE;
  const sections = [
    ...getSystemPromptSections(workdir, projectFile),
    `## 可用技能\n\n${skillDescriptions}`,
    `## 子代理类型\n\n${agentDescriptions}`,
  ];

  const outputStylePrompt = getOutputStylePrompt();
  if (outputStylePrompt) {
    sections.push(outputStylePrompt);
  }
  sections.push(loadPromptWithVars('system/claude-notes.md', {}));

  return sections.filter(Boolean).join('\n\n');
}

/**
 * 创建子代理的系统提示词
 */
export function getAgentBasePrompt(_workdir: string): string {
  return [
    loadPromptWithVars('system/identity-subagent.md', { productName: PRODUCT_NAME }),
    loadPromptWithVars('system/subagent-response.md', {}),
  ].join('\n\n');
}

export function createSubagentSystemPrompt(
  workdir: string,
  agentType: AgentType,
  options?: { taskDescription?: string }
): string {
  const basePrompt = getAgentBasePrompt(workdir);
  const config = getAgentByType(agentType);
  const agentSystemPrompt = [
    basePrompt,
    config?.systemPrompt ?? '',
  ].filter(Boolean).join('\n\n');

  return loadPromptWithVars('system/subagent-wrapper.md', {
    agentSystemPrompt,
    taskDescription: options?.taskDescription ?? '',
    envInfo: getEnvInfo(workdir),
  });
}

/**
 * 获取代理类型描述（用于系统提示词）
 */
export function getAgentDescriptions(): string {
  return getAgentTypeDescriptions();
}
