/**
 * 工具分发器 - 路由工具调用到具体实现
 */

import type { ExecuteToolFunc } from '../core/types.js';
import { runBash, runTaskOutput, runTaskStop } from './filesystem/bash.js';
import type { BashOptions } from './filesystem/bash.js';
import { runRead, runWrite, runEdit } from './filesystem/fileOps.js';
import { runGlob } from './search/glob.js';
import { runGrep } from './search/grep.js';
import { runAskUserQuestion } from './interaction/askQuestion.js';
import { runTodoWrite } from './interaction/todo.js';
import { runTaskCreate, runTaskGet, runTaskUpdate, runTaskList } from './interaction/taskManager.js';
import { runSkillLegacy } from './ai/skill.js';
import { runTask } from './agent/task.js';
import { runEnterPlanMode, runExitPlanMode } from './agent/planMode.js';
import { runWebFetch } from './network/webFetch.js';
import { runWebSearch } from './network/webSearch.js';
import type { SkillLoader } from './ai/skill.js';
import type { ProtocolAdapter } from '../services/ai/adapters/base.js';
import type { ToolDefinition, AgentType } from '../core/types.js';
import { isMCPTool } from '../services/mcp/registry.js';
import type { MCPRegistry } from '../services/mcp/registry.js';
import { runListMcpResources, runReadMcpResource } from './mcp/mcpTools.js';

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
  mcpRegistry?: MCPRegistry; // MCP 注册表
}

/**
 * 创建工具执行函数
 */
export function createExecuteTool(config: ToolExecutorConfig): ExecuteToolFunc {
  const { workdir, skillLoader, adapter, systemPrompt, tools, agentType, mcpRegistry } = config;

  return async (toolName: string, input: Record<string, unknown>): Promise<string> => {
    try {
      switch (toolName) {
        case 'bash': {
          // explore 代理使用只读模式
          const readOnly = agentType === 'explore';
          const bashOptions: BashOptions = {
            runInBackground: input.run_in_background as boolean | undefined,
            timeout: input.timeout as number | undefined,
            description: input.description as string | undefined,
          };
          return await runBash(workdir, input.command as string, readOnly, bashOptions);
        }

        case 'read_file':
          return await runRead(
            workdir,
            input.path as string,
            input.limit as number | undefined,
            input.offset as number | undefined
          );

        case 'write_file':
          return await runWrite(workdir, input.path as string, input.content as string);

        case 'edit_file':
          return await runEdit(
            workdir,
            input.path as string,
            input.old_text as string,
            input.new_text as string,
            input.replace_all as boolean | undefined
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
            input.maxResults as number | undefined,
            input.multiline as boolean | undefined,
            input.type as string | undefined,
            input.head_limit as number | undefined,
            input.offset as number | undefined
          );

        case 'AskUserQuestion':
          return await runAskUserQuestion(input.questions as any[]);

        case 'TodoWrite':
          return await runTodoWrite(input.todos as any[]);

        case 'TaskCreate':
          return runTaskCreate(input);

        case 'TaskGet':
          return runTaskGet(input.taskId as string);

        case 'TaskUpdate':
          return runTaskUpdate(input);

        case 'TaskList':
          return runTaskList();

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
            input.maxLength as number | undefined,
            input.prompt as string | undefined,
            adapter
          );

        case 'WebSearch':
          return await runWebSearch(
            input.query as string,
            input.maxResults as number | undefined,
            input.timeout as number | undefined
          );

        case 'TaskOutput':
          return await runTaskOutput(
            input.task_id as string,
            input.block as boolean | undefined,
            input.timeout as number | undefined
          );

        case 'TaskStop':
          return await runTaskStop(input.task_id as string);

        case 'Task':
          // Task 工具需要额外的依赖
          if (!adapter || !systemPrompt || !tools) {
            return '错误: Task 工具需要完整的代理上下文';
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
            createExecuteTool(config),
            {
              model: input.model as string | undefined,
              runInBackground: input.run_in_background as boolean | undefined,
              sessionId: input.resume as string | undefined,
            }
          );

        case 'ListMcpResources':
          if (!mcpRegistry) {
            return '错误: MCP 未启用';
          }
          return runListMcpResources(mcpRegistry, input.server as string | undefined);

        case 'ReadMcpResource':
          if (!mcpRegistry) {
            return '错误: MCP 未启用';
          }
          return await runReadMcpResource(
            mcpRegistry,
            input.server as string,
            input.uri as string
          );

        default:
          // MCP 工具路由（mcp__serverName__toolName）
          if (isMCPTool(toolName) && mcpRegistry) {
            return await mcpRegistry.executeTool(toolName, input);
          }
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
  runTaskOutput,
  runTaskStop,
  runRead,
  runWrite,
  runEdit,
  runGlob,
  runGrep,
  runAskUserQuestion,
  runTodoWrite,
  runTaskCreate,
  runTaskGet,
  runTaskUpdate,
  runTaskList,
  runSkillLegacy,
  runTask,
  runEnterPlanMode,
  runExitPlanMode,
  runWebFetch,
  runWebSearch,
  runListMcpResources,
  runReadMcpResource,
};
