/**
 * 工具分发器 - 路由工具调用到具体实现
 */

import type { ExecuteToolFunc, ToolExecutionResult, ExecuteToolContext } from '../core/types.js';
import { normalizeToolExecutionResult } from '../core/toolResult.js';
import { runBash, runTaskStop } from './filesystem/bash.js';
import { runTaskOutput } from './system/taskOutput.js';
import type { BashOptions } from './filesystem/bash.js';
import { runRead, runWrite, runEdit } from './filesystem/fileOps.js';
import { runGlob } from './search/glob.js';
import { runGrep } from './search/grep.js';
import type { GrepOutputMode } from './search/grep.js';
import { runAskUserQuestion } from './interaction/askQuestion.js';
import type { Question } from './interaction/askQuestion.js';
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
import type { HierarchicalAbortController } from '../core/abort.js';
import { loadPromptWithVars } from '../services/promptLoader.js';
import type { TodoItem } from './types.js';

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
  abortController?: HierarchicalAbortController; // 层级式中断控制器
  askUserQuestion?: (questions: Question[], initialAnswers?: Record<string, string>) => Promise<{ answers: Record<string, string> } | null>;
}

/**
 * 创建工具执行函数
 */
export function createExecuteTool(config: ToolExecutorConfig): ExecuteToolFunc {
  const { workdir, skillLoader, adapter, systemPrompt, tools, agentType, mcpRegistry, abortController, askUserQuestion } = config;

  return async (
    toolName: string,
    input: Record<string, unknown>,
    context?: ExecuteToolContext
  ): Promise<ToolExecutionResult> => {
    try {
      let result: string | ToolExecutionResult;
      switch (toolName) {
        case 'bash': {
          // Explore 代理使用只读模式
          const readOnly = String(agentType || '').toLowerCase() === 'explore';
          const bashOptions: BashOptions = {
            runInBackground: input.run_in_background as boolean | undefined,
            timeout: input.timeout as number | undefined,
            description: input.description as string | undefined,
          };
          result = await runBash(workdir, input.command as string, readOnly, bashOptions);
          break;
        }

        case 'read_file':
          result = await runRead(
            workdir,
            input.file_path as string,
            input.limit as number | undefined,
            input.offset as number | undefined
          );
          break;

        case 'write_file':
          result = await runWrite(workdir, input.file_path as string, input.content as string);
          break;

        case 'edit_file':
          result = await runEdit(
            workdir,
            input.file_path as string,
            input.old_text as string,
            input.new_text as string,
            input.replace_all as boolean | undefined
          );
          break;

        case 'Glob':
          result = await runGlob(
            workdir,
            input.pattern as string,
            input.path as string | undefined,
            input.ignore as string[] | undefined,
            input.maxResults as number | undefined
          );
          break;

        case 'Grep': {
          const outputMode =
            typeof input.outputMode === 'string' &&
            (['content', 'files_with_matches', 'count'] as const).includes(input.outputMode as GrepOutputMode)
              ? (input.outputMode as GrepOutputMode)
              : undefined;
          result = await runGrep(
            workdir,
            input.pattern as string,
            input.path as string | undefined,
            input.glob as string | undefined,
            outputMode,
            input.caseInsensitive as boolean | undefined,
            input.contextBefore as number | undefined,
            input.contextAfter as number | undefined,
            input.maxResults as number | undefined,
            input.multiline as boolean | undefined,
            input.type as string | undefined,
            input.head_limit as number | undefined,
            input.offset as number | undefined
          );
          break;
        }

        case 'AskUserQuestion': {
          if (askUserQuestion) {
            const output = await askUserQuestion(
              input.questions as Question[],
              (input.answers as Record<string, string> | undefined)
            );
            if (!output) {
              result = {
                content: loadPromptWithVars('tools/ask-user-declined.md', {}),
                uiContent: '用户取消回答问题。',
                isError: true,
              };
              break;
            }
            const formatted = Object.entries(output.answers)
              .map(([question, answer]) => `"${question}"="${answer}"`)
              .join(', ');
            const assistantText = loadPromptWithVars('tools/ask-user-answers.md', {
              formatted,
            });

            const uiLines = [
              '用户已回答以下问题:',
              ...Object.entries(output.answers).map(
                ([question, answer]) => `· ${question} → ${answer}`
              ),
            ];

            result = {
              content: assistantText,
              uiContent: uiLines.join('\n'),
            };
            break;
          }
          result = await runAskUserQuestion(Array.isArray(input.questions) ? (input.questions as Question[]) : []);
          break;
        }

        case 'TodoWrite':
          result = await runTodoWrite(Array.isArray(input.todos) ? (input.todos as TodoItem[]) : []);
          break;

        case 'TaskCreate':
          result = runTaskCreate(input);
          break;

        case 'TaskGet':
          result = runTaskGet(input.taskId as string);
          break;

        case 'TaskUpdate':
          result = runTaskUpdate(input);
          break;

        case 'TaskList':
          result = runTaskList();
          break;

        case 'Skill':
          result = await runSkillLegacy(skillLoader, input.skill as string);
          break;

        case 'EnterPlanMode':
          result = await runEnterPlanMode(input.taskDescription as string, workdir);
          break;

        case 'ExitPlanMode':
          result = await runExitPlanMode(workdir);
          break;

        case 'WebFetch':
          result = await runWebFetch(
            input.url as string,
            input.timeout as number | undefined,
            input.maxLength as number | undefined,
            input.prompt as string | undefined,
            adapter
          );
          break;

        case 'WebSearch':
          result = await runWebSearch(
            input.query as string,
            input.maxResults as number | undefined,
            input.timeout as number | undefined
          );
          break;

        case 'TaskOutput':
          result = await runTaskOutput(
            input,
            abortController?.signal
          );
          break;

        case 'TaskStop':
          result = await runTaskStop(input.task_id as string);
          break;

        case 'Task': {
          // Task 工具需要额外的依赖
          if (!adapter || !systemPrompt || !tools) {
            result = '错误: Task 工具需要完整的代理上下文';
            break;
          }

          // 为子代理创建子级 AbortController（中断子代理不影响父级）
          const childAbort = abortController?.createChild();

          result = await runTask(
            input.description as string,
            input.prompt as string,
            input.subagent_type as AgentType,
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
              abortController: childAbort,
              toolUseId: context?.toolUseId,
              sessionIdForLog: context?.sessionId,
            }
          );
          break;
        }

        case 'ListMcpResources':
          if (!mcpRegistry) {
            result = '错误: MCP 未启用';
            break;
          }
          result = runListMcpResources(mcpRegistry, input.server as string | undefined);
          break;

        case 'ReadMcpResource':
          if (!mcpRegistry) {
            result = '错误: MCP 未启用';
            break;
          }
          result = await runReadMcpResource(
            mcpRegistry,
            input.server as string,
            input.uri as string
          );
          break;

        default:
          // MCP 工具路由（mcp__serverName__toolName）
          if (isMCPTool(toolName) && mcpRegistry) {
            result = await mcpRegistry.executeTool(toolName, input);
            break;
          }
          result = `错误: 未知工具 "${toolName}"`;
          break;
      }
      return normalizeToolExecutionResult(result);
    } catch (error: unknown) {
      if (error instanceof Error) {
        return normalizeToolExecutionResult(`工具执行错误: ${error.message}`);
      }
      return normalizeToolExecutionResult(`工具执行错误: ${String(error)}`);
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
