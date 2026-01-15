/**
 * 工具分发器 - 路由工具调用到具体实现
 */

import type { ExecuteToolFunc } from '../core/types.js';
import { runBash } from './filesystem/bash.js';
import { runRead, runWrite, runEdit } from './filesystem/fileOps.js';
import { runGlob } from './search/glob.js';
import { runGrep } from './search/grep.js';
import { runAskUserQuestion } from './interaction/askQuestion.js';
import { runTodoWrite } from './interaction/todo.js';
import { runSkillLegacy } from './ai/skill.js';
import { runTask } from './agent/task.js';
import { runEnterPlanMode, runExitPlanMode } from './agent/planMode.js';
import { runWebFetch } from './network/webFetch.js';
import { runWebSearch } from './network/webSearch.js';
import type { SkillLoader } from './ai/skill.js';
import type { ProtocolAdapter } from '../services/ai/adapters/base.js';
import type { ToolDefinition, AgentType } from '../core/types.js';

/**
 * 工具执行器配置
 */
export interface ToolExecutorConfig {
  workdir: string;
  skillLoader: SkillLoader;
  adapter?: ProtocolAdapter;
  systemPrompt?: string;
  tools?: ToolDefinition[];
  agentType?: AgentType; // 当前代理类型（用于安全检查）
}

/**
 * 创建工具执行函数
 */
export function createExecuteTool(config: ToolExecutorConfig): ExecuteToolFunc {
  const { workdir, skillLoader, adapter, systemPrompt, tools, agentType } = config;

  return async (toolName: string, input: Record<string, unknown>): Promise<string> => {
    try {
      switch (toolName) {
        case 'bash':
          // explore 代理使用只读模式
          const readOnly = agentType === 'explore';
          return await runBash(workdir, input.command as string, readOnly);


        case 'read_file':
          return await runRead(workdir, input.path as string, input.limit as number | undefined);

        case 'write_file':
          return await runWrite(workdir, input.path as string, input.content as string);

        case 'edit_file':
          return await runEdit(
            workdir,
            input.path as string,
            input.old_text as string,
            input.new_text as string
          );

        case 'Glob':
          return await runGlob(
            workdir,
            input.pattern as string,
            input.path as string | undefined,
            input.ignore as string[] | undefined,
            input.maxResults as number | undefined
          );

        case 'Grep':
          return await runGrep(
            workdir,
            input.pattern as string,
            input.path as string | undefined,
            input.glob as string | undefined,
            input.outputMode as any,
            input.caseInsensitive as boolean | undefined,
            input.contextBefore as number | undefined,
            input.contextAfter as number | undefined,
            input.maxResults as number | undefined
          );

        case 'AskUserQuestion':
          return await runAskUserQuestion(input.questions as any[]);

        case 'TodoWrite':
          return await runTodoWrite(input.todos as any[]);

        case 'Skill':
          return await runSkillLegacy(skillLoader, input.skill as string);

        case 'EnterPlanMode':
          return await runEnterPlanMode(input.taskDescription as string, workdir);

        case 'ExitPlanMode':
          return await runExitPlanMode(workdir);

        case 'WebFetch':
          return await runWebFetch(
            input.url as string,
            input.timeout as number | undefined,
            input.maxLength as number | undefined
          );

        case 'WebSearch':
          return await runWebSearch(
            input.query as string,
            input.maxResults as number | undefined,
            input.timeout as number | undefined
          );

        case 'Task':
          // Task 工具需要额外的依赖，在第四阶段实现后传入
          if (!adapter || !systemPrompt || !tools) {
            return '错误: Task 工具需要完整的代理上下文（将在第四阶段实现）';
          }

          return await runTask(
            input.description as string,
            input.prompt as string,
            input.agent_type as AgentType,
            workdir,
            adapter,
            systemPrompt,
            tools,
            // 递归传入 executeTool（子代理也可以调用工具）
            createExecuteTool(config)
          );

        default:
          return `错误: 未知工具 "${toolName}"`;
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        return `工具执行错误: ${error.message}`;
      }
      return `工具执行错误: ${String(error)}`;
    }
  };
}

/**
 * 导出所有工具函数（用于测试）
 */
export {
  runBash,
  runRead,
  runWrite,
  runEdit,
  runGlob,
  runGrep,
  runAskUserQuestion,
  runTodoWrite,
  runSkillLegacy,
  runTask,
  runEnterPlanMode,
  runExitPlanMode,
  runWebFetch,
  runWebSearch
};
