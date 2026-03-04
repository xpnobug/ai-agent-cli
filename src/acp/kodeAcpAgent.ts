import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

import { JsonRpcError, JsonRpcPeer } from './jsonrpc.js';
import * as Protocol from './protocol.js';

import type { Message, ToolDefinition, ExecuteToolFunc, ToolExecutionResult } from '../core/types.js';
import { createAdapter } from '../services/ai/adapters/factory.js';
import { agentLoopGenerator } from '../core/loopGenerator.js';
import { createSystemPrompt, getAgentDescriptions } from '../core/prompts.js';
import { getAllTools } from '../tools/definitions.js';
import { createExecuteTool } from '../tools/dispatcher.js';
import { getSkillLoader } from '../tools/ai/skill.js';
import type { SkillLoader } from '../tools/ai/skill.js';
import { loadUserConfig } from '../services/config/configStore.js';
import { Config } from '../services/config/Config.js';
import { loadPermissionsConfig } from '../services/config/permissions.js';
import { getPermissionManager } from '../core/permissions.js';
import type { PermissionMode } from '../core/permissions.js';
import { getBuiltinCommands } from '../commands/builtinCommands.js';
import { setSessionId } from '../services/session/sessionId.js';
import { MCPRegistry } from '../services/mcp/registry.js';
import type { MCPServerConfig } from '../services/mcp/types.js';
import { getSessionProjectDir } from '../services/session/sessionLog.js';
import { HierarchicalAbortController } from '../core/abort.js';
import { PRODUCT_NAME, PRODUCT_COMMAND, VERSION } from '../core/constants.js';
import { getReminderManager } from '../core/reminder.js';
import type { AcpMcpWrappedClient } from './mcpClients.js';
import { buildAcpToolDefinitions, connectAcpMcpServers, listAcpResources } from './mcpClients.js';

const ACP_SESSION_STORE_VERSION = 1;
const MCP_TOOL_PREFIX = 'mcp__';

type SessionState = {
  sessionId: string;
  cwd: string;
  tools: ToolDefinition[];
  systemPrompt: string;
  messages: Message[];
  permissionManager: ReturnType<typeof getPermissionManager>;
  activeAbortController: HierarchicalAbortController | null;
  adapter: Awaited<ReturnType<typeof createAdapter>>;
  mcpRegistry: MCPRegistry;
  acpMcpClients: AcpMcpWrappedClient[];
  skillLoader: SkillLoader;
  toolCalls: Map<
    string,
    {
      title: string;
      kind: Protocol.ToolKind;
      status: Protocol.ToolCallStatus;
      rawInput?: Protocol.JsonObject;
    }
  >;
  currentModeId: Protocol.SessionModeId;
  toolSnapshots: Map<string, { path: string; oldText: string }>;
};

type PersistedSession = {
  version: number;
  sessionId: string;
  cwd: string;
  messages: Message[];
  currentModeId: string;
};

function asJsonObject(value: unknown): Protocol.JsonObject | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  try {
    JSON.stringify(value);
    return value as Protocol.JsonObject;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const PERMISSION_MODES: PermissionMode[] = [
  'ask',
  'acceptEdits',
  'bypassPermissions',
  'plan',
  'dontAsk',
  'default',
];

function isPermissionMode(value: string): value is PermissionMode {
  return PERMISSION_MODES.includes(value as PermissionMode);
}

function toolKindForName(toolName: string): Protocol.ToolKind {
  switch (toolName) {
    case 'read_file':
    case 'Read':
      return 'read';
    case 'write_file':
    case 'edit_file':
    case 'Write':
    case 'Edit':
    case 'MultiEdit':
      return 'edit';
    case 'Glob':
    case 'Grep':
      return 'search';
    case 'bash':
    case 'TaskOutput':
    case 'TaskStop':
      return 'execute';
    case 'WebFetch':
    case 'WebSearch':
      return 'fetch';
    case 'SwitchModel':
      return 'switch_mode';
    default:
      return 'other';
  }
}

function titleForToolCall(toolName: string, input: Record<string, unknown>): string {
  if ((toolName === 'read_file' || toolName === 'Read') && typeof input.file_path === 'string') {
    return `Read ${input.file_path}`;
  }
  if ((toolName === 'write_file' || toolName === 'edit_file' || toolName === 'Write' || toolName === 'Edit' || toolName === 'MultiEdit') && typeof input.file_path === 'string') {
    return `${toolName} ${input.file_path}`;
  }
  if (toolName === 'bash' && typeof input.command === 'string') {
    const cmd = input.command.trim().replace(/\s+/g, ' ');
    const clipped = cmd.length > 120 ? `${cmd.slice(0, 117)}...` : cmd;
    return `Run ${clipped}`;
  }
  if (toolName === 'Task' && typeof input.description === 'string') {
    return `Task ${input.description}`;
  }
  if (toolName === 'TaskOutput' && typeof input.task_id === 'string') {
    return `TaskOutput ${input.task_id}`;
  }
  return toolName;
}

function blocksToText(blocks: Protocol.ContentBlock[]): string {
  const parts: string[] = [];

  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue;

    switch (block.type) {
      case 'text': {
        const text = block.text;
        if (text) parts.push(text);
        break;
      }
      case 'resource': {
        const resource = block.resource || {};
        const uri = typeof resource.uri === 'string' ? resource.uri : '';
        const mimeType =
          typeof resource.mimeType === 'string' && resource.mimeType ? resource.mimeType : 'text/plain';
        if (typeof resource.text === 'string') {
          parts.push([
            '',
            `@resource ${uri} (${mimeType})`,
            '```',
            resource.text,
            '```',
          ].join('\n'));
        } else if (typeof resource.blob === 'string') {
          parts.push([
            '',
            `@resource ${uri} (${mimeType}) [base64]`,
            resource.blob,
          ].join('\n'));
        } else if (uri) {
          parts.push(`@resource ${uri} (${mimeType})`);
        }
        break;
      }
      case 'resource_link': {
        const uri = typeof block.uri === 'string' ? block.uri : '';
        const name = typeof block.name === 'string' ? block.name : '';
        const title = typeof block.title === 'string' ? block.title : '';
        const description = typeof block.description === 'string' ? block.description : '';

        parts.push([
          '',
          `@resource_link ${name || uri}`,
          ...(title ? [title] : []),
          ...(description ? [description] : []),
          ...(uri ? [uri] : []),
        ].join('\n'));
        break;
      }
      case 'image':
      case 'audio': {
        break;
      }
      default:
        break;
    }
  }

  return parts.join('\n').trim();
}

function getAcpSessionDir(cwd: string): string {
  return join(getSessionProjectDir(cwd), 'acp');
}

function getAcpSessionPath(cwd: string, sessionId: string): string {
  return join(getAcpSessionDir(cwd), `${sessionId}.json`);
}

function persistAcpSessionToDisk(session: SessionState): void {
  try {
    const dir = getAcpSessionDir(session.cwd);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const payload: PersistedSession = {
      version: ACP_SESSION_STORE_VERSION,
      sessionId: session.sessionId,
      cwd: session.cwd,
      messages: session.messages,
      currentModeId: session.currentModeId,
    };
    writeFileSync(getAcpSessionPath(session.cwd, session.sessionId), JSON.stringify(payload, null, 2), 'utf8');
  } catch {
    // 会话持久化失败时忽略
  }
}

function loadAcpSessionFromDisk(cwd: string, sessionId: string): PersistedSession | null {
  try {
    const filePath = getAcpSessionPath(cwd, sessionId);
    if (!existsSync(filePath)) return null;
    const raw = readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as PersistedSession;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.version !== ACP_SESSION_STORE_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

function getAvailableModes(): Protocol.SessionMode[] {
  return [
    { id: 'default', name: 'Default' },
    { id: 'acceptEdits', name: 'Accept Edits' },
    { id: 'plan', name: 'Plan' },
    { id: 'bypassPermissions', name: 'Bypass Permissions' },
    { id: 'dontAsk', name: 'Dont Ask' },
    { id: 'ask', name: 'Ask' },
  ];
}

function normalizeMcpEnv(
  env: Protocol.EnvVariable[] | undefined,
): Record<string, string> | undefined {
  if (!Array.isArray(env)) return undefined;
  const out: Record<string, string> = {};
  for (const entry of env) {
    if (!entry || typeof entry.name !== 'string') continue;
    out[entry.name] = typeof entry.value === 'string' ? entry.value : '';
  }
  return out;
}

function toMcpServerConfig(
  server: Protocol.McpServer,
  cwd: string,
): MCPServerConfig | null {
  const type = server.type ?? 'stdio';
  if (type !== 'stdio') {
    return null;
  }
  if (!server.name || !('command' in server)) return null;
  return {
    name: server.name,
    command: server.command,
    args: Array.isArray(server.args) ? server.args : [],
    env: normalizeMcpEnv(server.env),
    cwd,
  };
}

const SNAPSHOT_TOOL_NAMES = new Set([
  'write_file',
  'edit_file',
  'Write',
  'Edit',
  'MultiEdit',
]);

function resolveFilePath(inputPath: string, cwd: string): string {
  if (!inputPath) return inputPath;
  if (isAbsolute(inputPath)) return inputPath;
  return resolve(cwd, inputPath);
}

function readFileSafe(filePath: string): string {
  try {
    if (!filePath) return '';
    if (!existsSync(filePath)) return '';
    return readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function extractMessageText(message: Message): string {
  if (typeof message.content === 'string') return message.content;
  const blocks = Array.isArray(message.content) ? message.content : [];
  return blocks
    .filter((block): block is { type: 'text'; text: string } =>
      Boolean(block && block.type === 'text' && typeof block.text === 'string'))
    .map(block => block.text)
    .join('');
}

function parseMcpToolName(toolName: string): { serverName: string; toolName: string } | null {
  if (!toolName.startsWith(MCP_TOOL_PREFIX)) return null;
  const withoutPrefix = toolName.slice(MCP_TOOL_PREFIX.length);
  const sepIndex = withoutPrefix.indexOf('__');
  if (sepIndex === -1) {
    return { serverName: withoutPrefix, toolName: '' };
  }
  return {
    serverName: withoutPrefix.slice(0, sepIndex),
    toolName: withoutPrefix.slice(sepIndex + 2),
  };
}

function mcpContentToText(content: unknown[]): string {
  const parts: string[] = [];
  for (const block of content || []) {
    if (!isRecord(block)) continue;
    const type = typeof block.type === 'string' ? block.type : '';
    if (type === 'text' && typeof block.text === 'string') {
      parts.push(block.text);
      continue;
    }
    if (type === 'resource' && isRecord(block.resource) && typeof block.resource.text === 'string') {
      parts.push(block.resource.text);
      continue;
    }
    if (type === 'resource_link') {
      const name = typeof block.name === 'string'
        ? block.name
        : (typeof block.uri === 'string' ? block.uri : '');
      const title = typeof block.title === 'string' && block.title ? ` ${block.title}` : '';
      parts.push(`${name}${title}`.trim());
      continue;
    }
  }
  return parts.join('\n').trim() || '(无输出)';
}

export class KodeAcpAgent {
  private sessions = new Map<string, SessionState>();

  constructor(private readonly peer: JsonRpcPeer) {
    this.registerMethods();
  }

  private registerMethods(): void {
    this.peer.registerMethod('initialize', this.handleInitialize.bind(this));
    this.peer.registerMethod('authenticate', this.handleAuthenticate.bind(this));
    this.peer.registerMethod('session/new', this.handleSessionNew.bind(this));
    this.peer.registerMethod('session/load', this.handleSessionLoad.bind(this));
    this.peer.registerMethod('session/prompt', this.handleSessionPrompt.bind(this));
    this.peer.registerMethod('session/set_mode', this.handleSessionSetMode.bind(this));
    this.peer.registerMethod('session/cancel', this.handleSessionCancel.bind(this));
  }

  private async handleInitialize(params: unknown): Promise<Protocol.InitializeResponse> {
    const p = (params ?? {}) as Partial<Protocol.InitializeParams>;
    void p;

    return {
      protocolVersion: Protocol.ACP_PROTOCOL_VERSION,
      agentCapabilities: {
        loadSession: true,
        promptCapabilities: {
          image: false,
          audio: false,
          embeddedContext: true,
          embeddedContent: true,
        },
        mcpCapabilities: {
          http: true,
          sse: true,
        },
      },
      agentInfo: {
        name: PRODUCT_COMMAND,
        title: PRODUCT_NAME,
        version: VERSION,
      },
      authMethods: [],
    };
  }

  private async handleAuthenticate(_params: unknown): Promise<Protocol.AuthenticateResponse> {
    return {};
  }

  private async createSession(
    cwd: string,
    sessionId: string,
    mcpServers: Protocol.McpServer[] = [],
  ): Promise<SessionState> {
    if (!isAbsolute(cwd)) {
      throw new JsonRpcError(-32602, `cwd must be an absolute path: ${cwd}`);
    }

    const userConfig = loadUserConfig();
    if (!userConfig) {
      throw new JsonRpcError(-32602, 'Missing user config: ~/.ai-agent/config.json');
    }

    process.chdir(cwd);
    setSessionId(sessionId);

    const config = new Config(userConfig);
    getReminderManager().setProjectFileName(config.projectFile);
    const adapter = await createAdapter(config.provider, config.apiKey, config.model, config.baseUrl);
    const skillLoader = getSkillLoader(config.skillsDir);
    const systemPrompt = createSystemPrompt(
      cwd,
      skillLoader.getDescriptions(),
      getAgentDescriptions(),
      { projectFile: config.projectFile }
    );

    const mcpRegistry = new MCPRegistry(cwd);
    await mcpRegistry.loadConfig();
    const injected = mcpServers
      .map(server => toMcpServerConfig(server, cwd))
      .filter((value): value is MCPServerConfig => Boolean(value));
    if (injected.length > 0) {
      mcpRegistry.registerServers(injected);
    }
    if (mcpRegistry.hasServers()) {
      await mcpRegistry.connectAll();
    }

    // ACP 额外支持 http/sse MCP servers（SDK 客户端）
    const acpClients = await connectAcpMcpServers(
      mcpServers.filter(s => Boolean(s.type && s.type !== 'stdio')),
    );

    const tools = getAllTools([
      ...mcpRegistry.getAllTools(),
      ...buildAcpToolDefinitions(acpClients),
    ]);

    const permissionsConfig = loadPermissionsConfig(cwd);
    const permissionManager = getPermissionManager(permissionsConfig);

    const session: SessionState = {
      sessionId,
      cwd,
      tools,
      systemPrompt,
      messages: [],
      permissionManager,
      activeAbortController: null,
      adapter,
      mcpRegistry,
      acpMcpClients: acpClients,
      skillLoader,
      toolCalls: new Map(),
      currentModeId: permissionManager.getMode(),
      toolSnapshots: new Map(),
    };

    return session;
  }

  private async handleSessionNew(params: unknown): Promise<Protocol.NewSessionResponse> {
    const p = (params ?? {}) as Partial<Protocol.NewSessionParams>;
    const cwd = typeof p.cwd === 'string' ? p.cwd : '';
    if (!cwd) {
      throw new JsonRpcError(-32602, 'Missing required param: cwd');
    }

    const mcpServers = Array.isArray(p.mcpServers) ? (p.mcpServers as Protocol.McpServer[]) : [];

    const sessionId = `sess_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const session = await this.createSession(cwd, sessionId, mcpServers);

    this.sessions.set(sessionId, session);
    this.sendAvailableCommands(session);
    this.sendCurrentMode(session);
    persistAcpSessionToDisk(session);

    return {
      sessionId,
      modes: this.getModeState(session),
    };
  }

  private async handleSessionLoad(params: unknown): Promise<Protocol.LoadSessionResponse> {
    const p = (params ?? {}) as Partial<Protocol.LoadSessionParams>;
    const sessionId = typeof p.sessionId === 'string' ? p.sessionId : '';
    const cwd = typeof p.cwd === 'string' ? p.cwd : '';
    if (!sessionId) throw new JsonRpcError(-32602, 'Missing required param: sessionId');
    if (!cwd) throw new JsonRpcError(-32602, 'Missing required param: cwd');

    const mcpServers = Array.isArray(p.mcpServers) ? (p.mcpServers as Protocol.McpServer[]) : [];

    const persisted = loadAcpSessionFromDisk(cwd, sessionId);
    if (!persisted) {
      throw new JsonRpcError(-32602, `Session not found: ${sessionId}`);
    }

    const session = await this.createSession(cwd, sessionId, mcpServers);
    session.messages = Array.isArray(persisted.messages) ? persisted.messages : [];
    session.currentModeId = persisted.currentModeId || session.permissionManager.getMode();
    const persistedMode = session.currentModeId;
    if (isPermissionMode(persistedMode)) {
      session.permissionManager.setMode(persistedMode);
    }

    this.sessions.set(sessionId, session);
    this.sendAvailableCommands(session);
    this.sendCurrentMode(session);
    this.replayConversation(session);

    return { modes: this.getModeState(session) };
  }

  private async handleSessionSetMode(params: unknown): Promise<Protocol.SetSessionModeResponse> {
    const p = (params ?? {}) as Partial<Protocol.SetSessionModeParams>;
    const sessionId = typeof p.sessionId === 'string' ? p.sessionId : '';
    const modeId = typeof p.modeId === 'string' ? p.modeId : '';

    const session = this.sessions.get(sessionId);
    if (!session) throw new JsonRpcError(-32602, `Session not found: ${sessionId}`);

    const allowed = new Set(this.getModeState(session).availableModes.map(m => m.id));
    if (!allowed.has(modeId)) {
      throw new JsonRpcError(-32602, `Unknown modeId: ${modeId}`);
    }

    session.currentModeId = modeId;
    if (isPermissionMode(modeId)) {
      session.permissionManager.setMode(modeId);
    }
    this.sendCurrentMode(session);
    persistAcpSessionToDisk(session);

    return {};
  }

  private async handleSessionCancel(params: unknown): Promise<void> {
    const p = (params ?? {}) as Partial<Protocol.SessionCancelParams>;
    const sessionId = typeof p.sessionId === 'string' ? p.sessionId : '';
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.activeAbortController?.abort();
  }

  private async handleSessionPrompt(params: unknown): Promise<Protocol.PromptResponse> {
    const p = (params ?? {}) as Partial<Protocol.PromptParams> & {
      content?: Protocol.ContentBlock[];
    };
    const sessionId = typeof p.sessionId === 'string' ? p.sessionId : '';
    const blocks: Protocol.ContentBlock[] = Array.isArray(p.prompt)
      ? (p.prompt as Protocol.ContentBlock[])
      : Array.isArray(p.content)
        ? (p.content as Protocol.ContentBlock[])
        : [];

    const session = this.sessions.get(sessionId);
    if (!session) throw new JsonRpcError(-32602, `Session not found: ${sessionId}`);

    if (session.activeAbortController) {
      throw new JsonRpcError(-32000, `Session already has an active prompt: ${sessionId}`);
    }

    process.chdir(session.cwd);
    setSessionId(session.sessionId);

    const promptText = blocksToText(blocks);
    const userMsg: Message = {
      role: 'user',
      content: promptText,
      uuid: randomUUID(),
    };

    this.sendUserMessage(session.sessionId, promptText);

    const baseMessages: Message[] = [...session.messages, userMsg];
    session.messages.push(userMsg);

    const abortController = new HierarchicalAbortController();
    session.activeAbortController = abortController;

    const baseExecuteTool = createExecuteTool({
      workdir: session.cwd,
      skillLoader: session.skillLoader,
      adapter: session.adapter,
      systemPrompt: session.systemPrompt,
      tools: session.tools,
      mcpRegistry: session.mcpRegistry,
      abortController,
    });
    const executeTool = this.createAcpExecuteTool(session, baseExecuteTool);

    let stopReason: Protocol.StopReason = 'end_turn';

    try {
      const gen = agentLoopGenerator(
        baseMessages,
        session.systemPrompt,
        session.tools,
        session.adapter,
        executeTool,
        {
          permissionManager: session.permissionManager,
          abortController,
          persistSession: false,
          agentId: 'main',
        },
      );

      for await (const event of gen) {
        if (abortController.signal.aborted) {
          stopReason = 'cancelled';
          break;
        }

        switch (event.type) {
          case 'stream_text':
            this.sendAgentMessage(session.sessionId, event.text);
            break;
          case 'tool_queued': {
            const title = titleForToolCall(event.toolName, event.input);
            const kind = toolKindForName(event.toolName);
            session.toolCalls.set(event.toolUseId, {
              title,
              kind,
              status: 'pending',
              rawInput: asJsonObject(event.input),
            });
            this.peer.sendNotification('session/update', {
              sessionId: session.sessionId,
              update: {
                sessionUpdate: 'tool_call',
                toolCallId: event.toolUseId,
                title,
                kind,
                status: 'pending',
                rawInput: asJsonObject(event.input),
              } satisfies Protocol.ToolCall,
            } satisfies Protocol.SessionUpdateNotification);
            break;
          }
          case 'tool_start': {
            const existing = session.toolCalls.get(event.toolUseId);
            const title = existing?.title ?? titleForToolCall(event.toolName, event.input);
            const kind = existing?.kind ?? toolKindForName(event.toolName);
            session.toolCalls.set(event.toolUseId, {
              title,
              kind,
              status: 'in_progress',
              rawInput: existing?.rawInput ?? asJsonObject(event.input),
            });
            this.sendToolCallUpdate(session.sessionId, {
              toolCallId: event.toolUseId,
              status: 'in_progress',
            });
            if (SNAPSHOT_TOOL_NAMES.has(event.toolName)) {
              const filePathRaw =
                typeof event.input.file_path === 'string'
                  ? event.input.file_path
                  : typeof event.input.path === 'string'
                    ? event.input.path
                    : '';
              const absPath = resolveFilePath(filePathRaw, session.cwd);
              if (absPath) {
                const oldText = readFileSafe(absPath);
                session.toolSnapshots.set(event.toolUseId, {
                  path: absPath,
                  oldText,
                });
              }
            }
            break;
          }
          case 'tool_result': {
            const existing = session.toolCalls.get(event.toolUseId);
            const title = existing?.title ?? event.toolName;
            const kind = existing?.kind ?? toolKindForName(event.toolName);
            const status: Protocol.ToolCallStatus = event.isError ? 'failed' : 'completed';
            session.toolCalls.set(event.toolUseId, {
              title,
              kind,
              status,
              rawInput: existing?.rawInput,
            });
            const contentBlocks: Protocol.ToolCallContent[] = [];
            const snapshot = session.toolSnapshots.get(event.toolUseId);
            if (snapshot) {
              const newText = readFileSafe(snapshot.path);
              contentBlocks.push({
                type: 'diff',
                path: snapshot.path,
                oldText: snapshot.oldText,
                newText,
              });
              session.toolSnapshots.delete(event.toolUseId);
            }
            if (event.terminalId) {
              contentBlocks.push({ type: 'terminal', terminalId: event.terminalId });
            }
            if (event.result) {
              contentBlocks.push({ type: 'content', content: { type: 'text', text: event.result } });
            }
            this.sendToolCallUpdate(session.sessionId, {
              toolCallId: event.toolUseId,
              status,
              content: contentBlocks.length > 0 ? contentBlocks : undefined,
              rawOutput: asJsonObject(event.rawOutput),
            });
            break;
          }
          case 'permission_request': {
            const title = titleForToolCall(event.toolName, event.params);
            const kind = toolKindForName(event.toolName);
            const toolUseId = event.toolUseId;

            if (!session.toolCalls.has(toolUseId)) {
              session.toolCalls.set(toolUseId, { title, kind, status: 'pending', rawInput: asJsonObject(event.params) });
              this.peer.sendNotification('session/update', {
                sessionId: session.sessionId,
                update: {
                  sessionUpdate: 'tool_call',
                  toolCallId: toolUseId,
                  title,
                  kind,
                  status: 'pending',
                  rawInput: asJsonObject(event.params),
                } satisfies Protocol.ToolCall,
              } satisfies Protocol.SessionUpdateNotification);
            }

            const options: Protocol.PermissionOption[] = [
              { optionId: 'allow_once', name: 'Allow once', kind: 'allow_once' },
              { optionId: 'reject_once', name: 'Reject', kind: 'reject_once' },
            ];

            try {
              const response = await this.peer.sendRequest<Protocol.RequestPermissionResponse>({
                method: 'session/request_permission',
                params: {
                  sessionId: session.sessionId,
                  toolCall: {
                    toolCallId: toolUseId,
                    title,
                    kind,
                    status: 'pending',
                    content: [
                      {
                        type: 'content',
                        content: { type: 'text', text: event.reason || '需要权限确认' },
                      },
                    ],
                    rawInput: asJsonObject(event.params),
                  },
                  options,
                } satisfies Protocol.RequestPermissionParams,
                signal: abortController.signal,
                timeoutMs: 30_000,
              });

              const outcome = response?.outcome;
              if (!outcome || outcome.outcome === 'cancelled') {
                abortController.abort();
                event.resolve({ decision: 'deny' });
                break;
              }

              if (outcome.outcome === 'selected' && outcome.optionId === 'allow_once') {
                event.resolve({ decision: 'allow' });
                break;
              }

              if (outcome.outcome === 'selected' && outcome.optionId === 'allow_always') {
                event.resolve({ decision: 'allow_always', scope: 'tool' });
                break;
              }

              event.resolve({ decision: 'deny' });
            } catch {
              event.resolve({ decision: 'deny' });
            }
            break;
          }
          case 'turn_complete':
            session.messages = event.history;
            break;
          case 'error':
            this.sendAgentMessage(session.sessionId, event.message);
            break;
          default:
            break;
        }
      }
    } finally {
      if (abortController.signal.aborted) {
        stopReason = 'cancelled';
      }
      session.activeAbortController = null;
      persistAcpSessionToDisk(session);
    }

    return { stopReason };
  }

  private getModeState(session: SessionState): Protocol.SessionModeState {
    const availableModes = getAvailableModes();
    const currentModeId = session.currentModeId || availableModes[0]?.id || 'default';
    return { currentModeId, availableModes };
  }

  private sendAvailableCommands(session: SessionState): void {
    const availableCommands: Protocol.AvailableCommand[] = getBuiltinCommands()
      .filter(c => c.name !== 'debug')
      .map(c => ({
        name: c.name,
        description: c.description,
      }));

    this.peer.sendNotification('session/update', {
      sessionId: session.sessionId,
      update: {
        sessionUpdate: 'available_commands_update',
        availableCommands,
      } satisfies Protocol.AvailableCommandsUpdate,
    } satisfies Protocol.SessionUpdateNotification);
  }

  private sendCurrentMode(session: SessionState): void {
    this.peer.sendNotification('session/update', {
      sessionId: session.sessionId,
      update: {
        sessionUpdate: 'current_mode_update',
        currentModeId: session.currentModeId,
      } satisfies Protocol.CurrentModeUpdate,
    } satisfies Protocol.SessionUpdateNotification);
  }

  private sendUserMessage(sessionId: string, text: string): void {
    if (!text) return;
    this.peer.sendNotification('session/update', {
      sessionId,
      update: {
        sessionUpdate: 'user_message_chunk',
        content: { type: 'text', text },
      } satisfies Protocol.UserMessageChunk,
    } satisfies Protocol.SessionUpdateNotification);
  }

  private sendAgentMessage(sessionId: string, text: string): void {
    if (!text) return;
    this.peer.sendNotification('session/update', {
      sessionId,
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text', text },
      } satisfies Protocol.AgentMessageChunk,
    } satisfies Protocol.SessionUpdateNotification);
  }

  private sendToolCallUpdate(sessionId: string, update: Omit<Protocol.ToolCallUpdate, 'sessionUpdate'>): void {
    this.peer.sendNotification('session/update', {
      sessionId,
      update: {
        sessionUpdate: 'tool_call_update',
        ...update,
      } satisfies Protocol.ToolCallUpdate,
    } satisfies Protocol.SessionUpdateNotification);
  }

  private createAcpExecuteTool(
    session: SessionState,
    baseExecuteTool: ExecuteToolFunc,
  ): ExecuteToolFunc {
    const acpClientMap = new Map(session.acpMcpClients.map(client => [client.name, client]));

    return async (
      toolName: string,
      input: Record<string, unknown>,
      context,
    ): Promise<ToolExecutionResult> => {
      // 优先处理 ACP 注入的 MCP 工具
      const parsed = parseMcpToolName(toolName);
      if (parsed) {
        const wrapper = acpClientMap.get(parsed.serverName);
        if (wrapper) {
          try {
            const rawResult = await wrapper.client.callTool({
              name: parsed.toolName,
              arguments: input,
            });

            const rawRecord: Record<string, unknown> = isRecord(rawResult) ? rawResult : {};
            const contentBlocks = Array.isArray(rawRecord.content)
              ? (rawRecord.content as unknown[])
              : [];
            const toolResultValue = rawRecord.toolResult;
            const text = contentBlocks.length > 0
              ? mcpContentToText(contentBlocks)
              : typeof toolResultValue === 'string'
                ? toolResultValue
                : JSON.stringify(toolResultValue ?? rawResult, null, 2);

            return {
              content: text,
              uiContent: text,
              isError: Boolean(rawRecord.isError),
              rawOutput: asJsonObject(rawResult) ?? { result: rawResult },
            };
          } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            return {
              content: `MCP 工具执行错误: ${msg}`,
              uiContent: `MCP 工具执行错误: ${msg}`,
              isError: true,
              rawOutput: { error: msg },
            };
          }
        }
      }

      // MCP 资源列表（合并 stdio + http/sse）
      if (toolName === 'ListMcpResources' && session.acpMcpClients.length > 0) {
        const server = typeof input.server === 'string' ? input.server : undefined;
        const registryResources = session.mcpRegistry.getAllResources();
        const acpResources = listAcpResources(session.acpMcpClients, server);
        const merged = server
          ? [
              ...registryResources.filter(r => r.server === server),
              ...acpResources,
            ]
          : [...registryResources, ...acpResources];

        if (merged.length === 0) {
          const message = server
            ? `MCP 服务器 "${server}" 没有可用资源`
            : '没有可用的 MCP 资源';
          return {
            content: message,
            uiContent: message,
            isError: false,
            rawOutput: { resources: [] },
          };
        }

        const output = merged.map(r => ({
          server: r.server,
          uri: r.uri,
          name: r.name,
          description: r.description || '',
        }));
        const text = JSON.stringify(output, null, 2);
        return {
          content: text,
          uiContent: text,
          isError: false,
          rawOutput: { resources: output },
        };
      }

      // MCP 资源读取（http/sse 优先）
      if (toolName === 'ReadMcpResource' && session.acpMcpClients.length > 0) {
        const server = typeof input.server === 'string' ? input.server : '';
        const uri = typeof input.uri === 'string' ? input.uri : '';
        const wrapper = acpClientMap.get(server);
        if (wrapper && uri) {
          try {
            const raw = await wrapper.client.readResource({ uri });
            const textParts: string[] = [];
            const rawRecord: Record<string, unknown> = isRecord(raw) ? raw : {};
            const contents = Array.isArray(rawRecord.contents) ? (rawRecord.contents as unknown[]) : [];
            for (const content of contents) {
              if (isRecord(content) && typeof content.text === 'string') {
                textParts.push(content.text);
              }
            }
            const text = textParts.join('\n') || '(无内容)';
            return {
              content: text,
              uiContent: text,
              isError: false,
              rawOutput: asJsonObject(raw) ?? { contents: raw },
            };
          } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            return {
              content: `MCP 资源读取错误: ${msg}`,
              uiContent: `MCP 资源读取错误: ${msg}`,
              isError: true,
              rawOutput: { error: msg },
            };
          }
        }
      }

      return baseExecuteTool(toolName, input, context);
    };
  }

  private replayConversation(session: SessionState): void {
    for (const message of session.messages) {
      const text = extractMessageText(message);
      if (!text) continue;
      if (message.role === 'user') {
        this.sendUserMessage(session.sessionId, text);
      } else {
        this.sendAgentMessage(session.sessionId, text);
      }
    }
  }
}
