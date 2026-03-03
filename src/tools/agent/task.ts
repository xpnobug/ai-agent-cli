/**
 * 子代理任务执行器
 * 支持模型选择、后台运行、会话恢复
 */

import type { AgentType, Message, ToolDefinition, ExecuteToolFunc } from '../../core/types.js';
import type { ProtocolAdapter } from '../../services/ai/adapters/base.js';
import type { HierarchicalAbortController } from '../../core/abort.js';
import { agentLoop } from '../../core/loop.js';
import { getToolsForAgentType } from '../definitions.js';
import { createSubagentSystemPrompt } from '../../core/prompts.js';
import { getTheme } from '../../ui/theme.js';
import { getAgentConfig } from '../../core/agents.js';
import { generateUuid } from '../../utils/uuid.js';

/**
 * 子代理任务选项
 */
export interface TaskOptions {
  model?: string;
  runInBackground?: boolean;
  sessionId?: string; // 恢复之前的会话
  abortController?: HierarchicalAbortController; // 子代理中断控制器
}

/**
 * Agent 会话（用于恢复）
 */
interface AgentSession {
  id: string;
  agentType: AgentType;
  history: Message[];
  status: 'running' | 'completed' | 'failed';
  result?: string;
  model?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Agent 会话存储
 */
class AgentSessionStore {
  private sessions = new Map<string, AgentSession>();
  private nextId = 1;

  create(agentType: AgentType, model?: string): AgentSession {
    const id = `agent-${this.nextId++}`;
    const session: AgentSession = {
      id,
      agentType,
      history: [],
      status: 'running',
      model,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.sessions.set(id, session);
    return session;
  }

  get(id: string): AgentSession | undefined {
    return this.sessions.get(id);
  }

  update(id: string, updates: Partial<AgentSession>): void {
    const session = this.sessions.get(id);
    if (session) {
      Object.assign(session, updates, { updatedAt: Date.now() });
    }
  }

  list(): AgentSession[] {
    return Array.from(this.sessions.values());
  }
}

// 单例
let sessionStore: AgentSessionStore | null = null;

function getSessionStore(): AgentSessionStore {
  if (!sessionStore) {
    sessionStore = new AgentSessionStore();
  }
  return sessionStore;
}

/**
 * 子代理进度显示
 */
class SubagentProgress {
  private description: string;
  private agentType: AgentType;
  private toolCount = 0;
  private startTime: number;
  private theme = getTheme();

  constructor(description: string, agentType: AgentType) {
    this.description = description;
    this.agentType = agentType;
    this.startTime = Date.now();
  }

  /**
   * 开始显示
   */
  start(): void {
    process.stdout.write(
      this.theme.textDim(`  [${this.agentType}] ${this.description}`)
    );
  }


  /**
   * 更新进度（同一行覆盖）
   */
  update(toolName: string, count: number, elapsed: number): void {
    this.toolCount = count;

    // 清除当前行并重写
    process.stdout.write('\r\x1b[K');
    process.stdout.write(
      this.theme.textDim(
        `  [${this.agentType}] ${this.description} ... ${toolName} (+${count} tools, ${elapsed.toFixed(1)}s)`
      )
    );
  }

  /**
   * 完成显示
   */
  complete(): void {
    const elapsed = (Date.now() - this.startTime) / 1000;
    process.stdout.write('\r\x1b[K');
    console.log(
      this.theme.success(
        `  [${this.agentType}] ${this.description} - done (${this.toolCount} tools, ${elapsed.toFixed(1)}s)`
      )
    );
  }

  /**
   * 错误显示
   */
  error(message: string): void {
    process.stdout.write('\r\x1b[K');
    console.log(
      this.theme.error(
        `  [${this.agentType}] ${this.description} - error: ${message}`
      )
    );
  }
}

/**
 * 执行子代理任务
 */
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
): Promise<string> {
  const { model, runInBackground = false, sessionId, abortController } = taskOptions;
  const store = getSessionStore();
  const agentConfig = getAgentConfig(agentType);

  // 后台运行模式
  if (runInBackground) {
    const session = store.create(agentType, model);

    // 异步执行，不等待完成
    executeSubagent(
      description, prompt, agentType, workdir, adapter,
      _systemPrompt, _tools, _executeTool, agentConfig, model, abortController
    ).then((result) => {
      store.update(session.id, {
        status: 'completed',
        result,
      });
    }).catch((error: unknown) => {
      const errorMsg = error instanceof Error ? error.message : String(error);
      store.update(session.id, {
        status: 'failed',
        result: `错误: ${errorMsg}`,
      });
    });

    return JSON.stringify({
      sessionId: session.id,
      status: 'running',
      message: `子代理已在后台启动: ${session.id}`,
    });
  }

  // 恢复模式
  if (sessionId) {
    const session = store.get(sessionId);
    if (!session) {
      return `错误: 未找到会话 "${sessionId}"`;
    }

    if (session.status === 'running') {
      return `会话 ${sessionId} 仍在运行中...`;
    }

    if (session.result) {
      return session.result;
    }

    return `会话 ${sessionId} 状态: ${session.status}，无结果`;
  }

  // 前台执行
  return await executeSubagent(
    description, prompt, agentType, workdir, adapter,
    _systemPrompt, _tools, _executeTool, agentConfig, model, abortController
  );
}

/**
 * 实际执行子代理逻辑
 */
async function executeSubagent(
  description: string,
  prompt: string,
  agentType: AgentType,
  workdir: string,
  adapter: ProtocolAdapter,
  _systemPrompt: string,
  _tools: ToolDefinition[],
  _executeTool: ExecuteToolFunc,
  agentConfig: { maxTokens?: number; maxTurns?: number },
  _model?: string,
  abortController?: HierarchicalAbortController
): Promise<string> {
  const progress = new SubagentProgress(description, agentType);

  try {
    progress.start();

    // 1. 根据 agentType 过滤工具
    const subagentTools = getToolsForAgentType(agentType);

    // 2. 创建子代理的系统提示词
    const subagentSystem = createSubagentSystemPrompt(workdir, agentType, description);

    // 3. 创建隔离的消息历史
    const subagentHistory: Message[] = [
      {
        role: 'user',
        content: prompt,
        uuid: generateUuid(),
      },
    ];

    // 4. 调用代理循环（静默模式 + 进度回调）
    const resultHistory = await agentLoop(
      subagentHistory,
      subagentSystem,
      subagentTools,
      adapter,
      // 创建子代理专用的 executeTool，传入 agentType 进行安全检查
      (toolName, input) => {
        // 为子代理创建带有 agentType 的执行函数
        const { createExecuteTool } = require('../dispatcher.js');
        const { getSkillLoader } = require('./skill.js');

        const subExecutor = createExecuteTool({
          workdir,
          skillLoader: getSkillLoader(workdir + '/skills'),
          adapter,
          systemPrompt: _systemPrompt,
          tools: _tools,
          agentType, // 传入当前子代理类型
          abortController, // 传入中断控制器
        });

        return subExecutor(toolName, input);
      },
      {
        maxTokens: agentConfig.maxTokens || 4096,
        maxTurns: agentConfig.maxTurns || 10,
        silent: true, // 静默模式，不打印工具调用
        abortController, // 传入中断控制器
        persistSession: false,
        onToolCall: (name, count, elapsed) => {
          progress.update(name, count, elapsed);
        },
      }
    );

    // 5. 完成进度显示
    progress.complete();

    // 6. 提取最后一条助手消息作为总结
    const lastAssistantMsg = resultHistory
      .slice()
      .reverse()
      .find((msg) => msg.role === 'assistant');

    if (!lastAssistantMsg) {
      return `子代理任务完成: ${description}\n(无输出)`;
    }

    // 提取文本内容
    let summary = '';
    if (typeof lastAssistantMsg.content === 'string') {
      summary = lastAssistantMsg.content;
    } else {
      const textBlocks = lastAssistantMsg.content.filter((block) => block.type === 'text');
      summary = textBlocks.map((block) => ('text' in block ? block.text : '')).join('\n\n');
    }

    return `子代理任务结果 (${description}, ${agentType}):

${summary}

---
子代理执行完成`;
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    progress.error(errorMsg);
    return `错误: 子代理执行失败: ${errorMsg}`;
  }
}
