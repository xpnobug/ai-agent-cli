/**
 * statusNoticeDefinitions — 启动提醒定义
 *
 * - 用定义式规则列表统一管理提醒
 * - 只承载启动阶段值得打断注意力的异常/风险提示
 * - 中性或正向状态不放在这里
 *
 * 适配说明：
 * - 当前项目真正注入系统提示词的是 projectFile（默认 AI-AGENTS.md）
 * - 因此这里用“项目指令文件过大”作为等价提醒，而不是 .ai-agent/memory/
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import figures from 'figures';
import * as React from 'react';
import type { AgentConfig } from '../../../core/agents.js';
import { getActiveAgents } from '../../../core/agents.js';
import { Box, Text } from '../primitives.js';
import { getInkColors } from '../../theme.js';
import { formatNumber } from '../../../utils/format.js';

export const MAX_PROJECT_FILE_CHARACTER_COUNT = 40_000;
export const AGENT_DESCRIPTIONS_THRESHOLD = 15_000;

export type ProjectInstructionFileInfo = {
  path: string;
  content: string;
};

export type StatusNoticeType = 'warning' | 'info';

export type StatusNoticeContext = {
  workdir: string;
  projectFile: string;
  projectInstructionFiles: ProjectInstructionFileInfo[];
  activeAgents: AgentConfig[];
};

export type StatusNoticeDefinition = {
  id: string;
  type: StatusNoticeType;
  isActive: (context: StatusNoticeContext) => boolean;
  render: (context: StatusNoticeContext) => React.ReactNode;
};

/**
 * 当前项目没有精确 tokenizer，这里沿用仓库现有的粗估口径：
 * 约 4 个字符折算 1 个 token。
 */
function roughTokenCountEstimation(text: string): number {
  return Math.ceil(text.length / 4);
}

function getProjectInstructionFiles(
  workdir: string,
  projectFile: string,
): ProjectInstructionFileInfo[] {
  const filePath = join(workdir, projectFile);
  if (!existsSync(filePath)) {
    return [];
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    return [{ path: filePath, content }];
  } catch {
    return [];
  }
}

function getLargeProjectInstructionFiles(
  files: ProjectInstructionFileInfo[],
): ProjectInstructionFileInfo[] {
  return files.filter(
    (file) => file.content.length > MAX_PROJECT_FILE_CHARACTER_COUNT,
  );
}

function getAgentDescriptionsTotalTokens(activeAgents: AgentConfig[]): number {
  return activeAgents
    .filter((agent) => agent.source !== 'built-in')
    .reduce((total, agent) => {
      const description = `${agent.agentType}: ${agent.whenToUse}`;
      return total + roughTokenCountEstimation(description);
    }, 0);
}

const projectInstructionFilesNotice: StatusNoticeDefinition = {
  id: 'large-project-instruction-files',
  type: 'warning',
  isActive: (context) => getLargeProjectInstructionFiles(context.projectInstructionFiles).length > 0,
  render: (context) => {
    const colors = getInkColors();
    const largeFiles = getLargeProjectInstructionFiles(context.projectInstructionFiles);

    return (
      <>
        {largeFiles.map((file) => {
          const displayPath = file.path.startsWith(context.workdir)
            ? relative(context.workdir, file.path)
            : file.path;

          return (
            <Box key={file.path} flexDirection="row">
              <Text color={colors.warning}>{figures.warning}</Text>
              <Text color={colors.warning}>
                项目指令文件 <Text bold>{displayPath}</Text> 过大会影响性能
                ({formatNumber(file.content.length)} chars &gt;{' '}
                {formatNumber(MAX_PROJECT_FILE_CHARACTER_COUNT)})
                <Text dimColor> · 请精简该文件内容</Text>
              </Text>
            </Box>
          );
        })}
      </>
    );
  },
};

const largeAgentDescriptionsNotice: StatusNoticeDefinition = {
  id: 'large-agent-descriptions',
  type: 'warning',
  isActive: (context) =>
    getAgentDescriptionsTotalTokens(context.activeAgents) >
    AGENT_DESCRIPTIONS_THRESHOLD,
  render: (context) => {
    const colors = getInkColors();
    const totalTokens = getAgentDescriptionsTotalTokens(context.activeAgents);

    return (
      <Box flexDirection="row">
        <Text color={colors.warning}>{figures.warning}</Text>
        <Text color={colors.warning}>
          自定义代理描述总量过大会影响性能 (~
          {formatNumber(totalTokens)} tokens &gt;{' '}
          {formatNumber(AGENT_DESCRIPTIONS_THRESHOLD)})
          <Text dimColor> · 使用 /agents 管理</Text>
        </Text>
      </Box>
    );
  },
};

export const statusNoticeDefinitions: StatusNoticeDefinition[] = [
  projectInstructionFilesNotice,
  largeAgentDescriptionsNotice,
];

export function createStatusNoticeContext(
  workdir: string,
  projectFile: string,
): StatusNoticeContext {
  return {
    workdir,
    projectFile,
    projectInstructionFiles: getProjectInstructionFiles(workdir, projectFile),
    activeAgents: getActiveAgents(),
  };
}

export function getActiveNotices(
  context: StatusNoticeContext,
): StatusNoticeDefinition[] {
  return statusNoticeDefinitions.filter((notice) => notice.isActive(context));
}
