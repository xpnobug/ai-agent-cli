/**
 * 子代理任务执行器
 */

import type { AgentType, Message, ToolDefinition, ExecuteToolFunc, ContentBlock, ToolResultBlock, ToolExecutionResult, ToolUseBlock } from '../../core/types.js';
import type { ProtocolAdapter } from '../../services/ai/adapters/base.js';
import type { HierarchicalAbortController } from '../../core/abort.js';
import { agentLoop } from '../../core/loop.js';
import { getToolsForAgentType } from '../definitions.js';
import { createSubagentSystemPrompt } from '../../core/prompts.js';
import { generateUuid } from '../../utils/uuid.js';
import { getAgentByType, getAvailableAgentTypes } from '../../core/agents.js';
import { generateAgentId } from '../../services/agent/storage.js';
import { getAgentTranscript, saveAgentTranscript } from '../../services/agent/transcripts.js';
import { upsertBackgroundAgentTask } from '../../services/session/backgroundAgentTasks.js';
import type { BackgroundAgentTaskRuntime } from '../../services/session/backgroundAgentTasks.js';
import { getSessionLogFilePath } from '../../services/session/sessionLog.js';
import { getSessionId } from '../../services/session/sessionId.js';
import { existsSync, readFileSync } from 'node:fs';
import { loadPromptWithVars } from '../../services/promptLoader.js';

/**
 * 子代理任务选项
 */
export interface TaskOptions {
  model?: string;
  runInBackground?: boolean;
  sessionId?: string; // 恢复之前的会话
  abortController?: HierarchicalAbortController; // 子代理中断控制器
  toolUseId?: string; // 用于 fork context
  sessionIdForLog?: string; // 用于读取主会话日志
}

type TaskResultStatus = 'async_launched' | 'completed';

const FORK_CONTEXT_TOOL_RESULT_TEXT = loadPromptWithVars('tools/task-fork-context.md', {});

function createUserMessage(content: string | ContentBlock[]): Message {
  return {
    role: 'user',
    content,
    uuid: generateUuid(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isMessage(value: unknown): value is Message {
  if (!isRecord(value)) return false;
  const role = value.role;
  if (role !== 'user' && role !== 'assistant') return false;
  const uuid = value.uuid;
  if (typeof uuid !== 'string' || !uuid) return false;
  const content = value.content;
  if (typeof content === 'string') return true;
  if (!Array.isArray(content)) return false;
  return true;
}

function readSessionMessages(sessionId: string): Message[] {
  const filePath = getSessionLogFilePath({ cwd: process.cwd(), sessionId });
  if (!existsSync(filePath)) return [];
  try {
    const raw = readFileSync(filePath, 'utf8');
    const lines = raw.split('\n');
    const messages: Message[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        continue;
      }
      if (!isRecord(parsed)) continue;
      const entryType = parsed.type;
      if (entryType !== 'user' && entryType !== 'assistant') continue;
      const messageValue = parsed.message;
      if (isMessage(messageValue)) {
        messages.push(messageValue);
      }
    }
    return messages;
  } catch {
    return [];
  }
}

function buildForkContextForAgent(options: {
  enabled: boolean;
  prompt: string;
  toolUseId: string | undefined;
  sessionId: string;
}): { forkContextMessages: Message[]; promptMessages: Message[] } {
  const userPromptMessage = createUserMessage(options.prompt);

  if (!options.enabled || !options.toolUseId) {
    return {
      forkContextMessages: [],
      promptMessages: [userPromptMessage],
    };
  }

  const mainMessages = readSessionMessages(options.sessionId);
  if (!mainMessages || mainMessages.length === 0) {
    return {
      forkContextMessages: [],
      promptMessages: [userPromptMessage],
    };
  }

  let toolUseMessageIndex = -1;
  let toolUseMessage: Message | null = null;
  let taskToolUseBlock: ToolUseBlock | null = null;

  for (let i = 0; i < mainMessages.length; i++) {
    const msg = mainMessages[i];
    if (msg?.role !== 'assistant') continue;
    const blocks = Array.isArray(msg?.content) ? (msg.content as ContentBlock[]) : [];
    const match = blocks.find(
      (b): b is ToolUseBlock => Boolean(b && b.type === 'tool_use' && b.id === options.toolUseId),
    );
    if (!match) continue;
    toolUseMessageIndex = i;
    toolUseMessage = msg;
    taskToolUseBlock = match;
    break;
  }

  if (toolUseMessageIndex === -1 || !toolUseMessage || !taskToolUseBlock) {
    return {
      forkContextMessages: [],
      promptMessages: [userPromptMessage],
    };
  }

  const forkContextMessages = mainMessages.slice(0, toolUseMessageIndex);

  const toolUseOnlyAssistant: Message = {
    ...toolUseMessage,
    uuid: generateUuid(),
    content: [taskToolUseBlock],
  };

  const forkContextToolResult: Message = createUserMessage([
    {
      type: 'tool_result',
      tool_use_id: taskToolUseBlock.id,
      content: FORK_CONTEXT_TOOL_RESULT_TEXT,
    } as ToolResultBlock,
  ]);

  return {
    forkContextMessages,
    promptMessages: [toolUseOnlyAssistant, forkContextToolResult, userPromptMessage],
  };
}

async function resolveAdapter(
  baseAdapter: ProtocolAdapter,
  model?: string
): Promise<ProtocolAdapter> {
  const trimmed = typeof model === 'string' ? model.trim() : '';
  if (!trimmed || trimmed === 'inherit' || trimmed === baseAdapter.getModel()) return baseAdapter;
  const cloneable = baseAdapter as { cloneWithModel?: (model: string) => Promise<ProtocolAdapter> | ProtocolAdapter };
  if (typeof cloneable.cloneWithModel === 'function') {
    return await cloneable.cloneWithModel(trimmed);
  }
  return baseAdapter;
}

function extractLastAssistantText(history: Message[]): string {
  const lastAssistant = [...history].reverse().find(m => m.role === 'assistant');
  if (!lastAssistant) return '(无输出)';

  if (typeof lastAssistant.content === 'string') return lastAssistant.content;
  const blocks = lastAssistant.content as ContentBlock[];
  return blocks
    .filter(b => b.type === 'text')
    .map(b => (b.type === 'text' ? b.text : ''))
    .join('\n')
    .trim();
}

function asyncLaunchMessage(agentId: string): string {
  const toolName = 'TaskOutput';
  return loadPromptWithVars('tools/task-async-launch.md', {
    agentId,
    toolName,
  });
}

function buildUiContent(status: TaskResultStatus, output: {
  description: string;
  prompt: string;
  summary: string;
  agentId: string;
}): string {
  if (status === 'async_launched') {
    return `已在后台启动子代理：${output.description} (agentId: ${output.agentId})`;
  }
  return output.summary || '(无输出)';
}

export async function runTask(
  description: string,
  prompt: string,
  agentType: AgentType,
  workdir: string,
  adapter: ProtocolAdapter,
  _systemPrompt: string,
  _tools: ToolDefinition[],
  _executeTool: ExecuteToolFunc,
  taskOptions: TaskOptions = {}
): Promise<string | ToolExecutionResult> {
  const {
    model,
    runInBackground = false,
    sessionId,
    abortController,
    toolUseId,
    sessionIdForLog,
  } = taskOptions;

  const availableTypes = getAvailableAgentTypes();
  if (!availableTypes.includes(agentType)) {
    return `错误: 未找到子代理类型 "${agentType}"。可用类型: ${availableTypes.join(', ')}`;
  }

  const agentConfig = getAgentByType(agentType);
  if (!agentConfig) {
    return `错误: 未找到子代理类型 "${agentType}"。`;
  }

  const agentId = sessionId || generateAgentId();
  const baseTranscript = sessionId ? (getAgentTranscript(sessionId) ?? null) : [];

  if (sessionId && baseTranscript === null) {
    return `错误: 未找到 Agent 会话 "${sessionId}"`;
  }

  const effectivePrompt = prompt;
  const forkContextEnabled = agentConfig.forkContext === true;
  const { forkContextMessages, promptMessages } = buildForkContextForAgent({
    enabled: forkContextEnabled,
    prompt: effectivePrompt,
    toolUseId,
    sessionId: sessionIdForLog ?? getSessionId(),
  });

  const transcriptMessages: Message[] = [
    ...(baseTranscript || []),
    ...promptMessages,
  ];

  const messagesForQuery: Message[] = [
    ...forkContextMessages,
    ...transcriptMessages,
  ];

  const systemPrompt = createSubagentSystemPrompt(workdir, agentType, {
    taskDescription: description,
  });
  const subagentTools = getToolsForAgentType(agentType);
  const envSubagentModel =
    process.env.AI_AGENT_SUBAGENT_MODEL ??
    process.env.KODE_SUBAGENT_MODEL ??
    process.env.CLAUDE_CODE_SUBAGENT_MODEL;
  const modelToUse =
    typeof envSubagentModel === 'string' && envSubagentModel.trim()
      ? envSubagentModel.trim()
      : (model ?? agentConfig.model);
  const subAdapter = await resolveAdapter(adapter, modelToUse);

  if (runInBackground) {
    const bgAbortController = new AbortController();
    const taskRecord: BackgroundAgentTaskRuntime = {
      type: 'async_agent',
      agentId,
      description,
      prompt: effectivePrompt,
      status: 'running',
      startedAt: Date.now(),
      messages: [...transcriptMessages],
      abortController: bgAbortController,
      done: Promise.resolve(),
    };

    taskRecord.done = (async () => {
      try {
        const history = await agentLoop(
          messagesForQuery,
          systemPrompt,
          subagentTools,
          subAdapter,
          (toolName, input, context) => _executeTool(toolName, input, context),
          {
            maxTokens: agentConfig.maxTokens || 4096,
            maxTurns: agentConfig.maxTurns || 10,
            silent: true,
            abortController: bgAbortController,
            persistSession: true,
            agentId,
          }
        );

        const summary = extractLastAssistantText(history);
        taskRecord.status = 'completed';
        taskRecord.completedAt = Date.now();
        taskRecord.resultText = summary;
        taskRecord.messages = [...history];
        upsertBackgroundAgentTask(taskRecord);
        saveAgentTranscript(agentId, history);
      } catch (e) {
        taskRecord.status = 'failed';
        taskRecord.completedAt = Date.now();
        taskRecord.error = e instanceof Error ? e.message : String(e);
        upsertBackgroundAgentTask(taskRecord);
      }
    })();

    upsertBackgroundAgentTask(taskRecord);

    return {
      content: asyncLaunchMessage(agentId),
      uiContent: buildUiContent('async_launched', {
        description,
        prompt: effectivePrompt,
        summary: '',
        agentId,
      }),
      rawOutput: {
        agentId,
        status: 'running',
        description,
        prompt: effectivePrompt,
      },
    };
  }

  const resultHistory = await agentLoop(
    messagesForQuery,
    systemPrompt,
    subagentTools,
    subAdapter,
    (toolName, input, context) => _executeTool(toolName, input, context),
    {
      maxTokens: agentConfig.maxTokens || 4096,
      maxTurns: agentConfig.maxTurns || 10,
      silent: true,
      abortController,
      persistSession: true,
      agentId,
    }
  );

  saveAgentTranscript(agentId, resultHistory);

  const summary = extractLastAssistantText(resultHistory);
  const assistantResult = `${summary}\n\nagentId: ${agentId} (for resuming to continue this agent's work if needed)`;

  return {
    content: assistantResult,
    uiContent: buildUiContent('completed', {
      description,
      prompt: effectivePrompt,
      summary,
      agentId,
    }),
    rawOutput: {
      agentId,
      status: 'completed',
      description,
      prompt: effectivePrompt,
      result: summary,
    },
  };
}
