/**
 * MCP 客户端
 * 通过 stdio 与 MCP 服务器通信（JSON-RPC 2.0）
 */

import { spawn, type ChildProcess } from 'child_process';
import type {
  MCPServerConfig,
  MCPToolDefinition,
  MCPResource,
  MCPToolCallResult,
  MCPResourceReadResult,
  JsonRpcRequest,
  JsonRpcResponse,
} from './types.js';

/**
 * MCP 客户端
 */
export class MCPClient {
  private config: MCPServerConfig;
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, {
    resolve: (value: unknown) => void;
    reject: (reason: Error) => void;
  }>();
  private buffer = '';
  private connected = false;
  private tools: MCPToolDefinition[] = [];
  private resources: MCPResource[] = [];

  constructor(config: MCPServerConfig) {
    this.config = config;
  }

  /**
   * 连接到 MCP 服务器
   */
  async connect(): Promise<void> {
    if (this.connected) return;

    const { command, args = [], env, cwd } = this.config;

    this.process = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
      cwd: cwd || process.cwd(),
    });

    // 监听 stdout
    this.process.stdout?.on('data', (data: Buffer) => {
      this.buffer += data.toString();
      this.processBuffer();
    });

    // 监听 stderr（用于调试）
    this.process.stderr?.on('data', () => {
      // MCP 服务器的 stderr 日志，静默处理
    });

    // 监听进程退出
    this.process.on('exit', (code) => {
      this.connected = false;
      // 拒绝所有待处理请求
      for (const [, pending] of this.pendingRequests) {
        pending.reject(new Error(`MCP 服务器退出 (code: ${code})`));
      }
      this.pendingRequests.clear();
    });

    // 发送 initialize 请求
    try {
      await this.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'ai-agent-cli',
          version: '1.0.0',
        },
      });

      // 发送 initialized 通知
      this.sendNotification('notifications/initialized', {});

      this.connected = true;

      // 加载工具和资源列表
      await this.refreshCapabilities();
    } catch (error: unknown) {
      this.disconnect();
      throw error;
    }
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.process) {
      this.process.stdin?.end();
      this.process.kill();
      this.process = null;
    }
    this.connected = false;
    this.pendingRequests.clear();
    this.buffer = '';
  }

  /**
   * 是否已连接
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * 获取服务器名称
   */
  getName(): string {
    return this.config.name;
  }

  /**
   * 刷新工具和资源列表
   */
  async refreshCapabilities(): Promise<void> {
    try {
      const toolsResult = await this.sendRequest('tools/list', {}) as {
        tools: MCPToolDefinition[];
      };
      this.tools = toolsResult?.tools || [];
    } catch {
      this.tools = [];
    }

    try {
      const resourcesResult = await this.sendRequest('resources/list', {}) as {
        resources: MCPResource[];
      };
      this.resources = resourcesResult?.resources || [];
    } catch {
      this.resources = [];
    }
  }

  /**
   * 列出可用工具
   */
  listTools(): MCPToolDefinition[] {
    return this.tools;
  }

  /**
   * 列出可用资源
   */
  listResources(): MCPResource[] {
    return this.resources;
  }

  /**
   * 调用工具
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<MCPToolCallResult> {
    const result = await this.sendRequest('tools/call', {
      name,
      arguments: args,
    });
    return result as MCPToolCallResult;
  }

  /**
   * 读取资源
   */
  async readResource(uri: string): Promise<MCPResourceReadResult> {
    const result = await this.sendRequest('resources/read', { uri });
    return result as MCPResourceReadResult;
  }

  /**
   * 发送 JSON-RPC 请求
   */
  private sendRequest(method: string, params: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.process?.stdin?.writable) {
        reject(new Error('MCP 服务器未连接'));
        return;
      }

      const id = ++this.requestId;
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      this.pendingRequests.set(id, { resolve, reject });

      const message = JSON.stringify(request) + '\n';
      this.process.stdin.write(message);

      // 超时处理
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`MCP 请求超时: ${method}`));
        }
      }, 30000);
    });
  }

  /**
   * 发送 JSON-RPC 通知（无 id，不期望响应）
   */
  private sendNotification(method: string, params: Record<string, unknown>): void {
    if (!this.process?.stdin?.writable) return;

    const notification = {
      jsonrpc: '2.0',
      method,
      params,
    };

    this.process.stdin.write(JSON.stringify(notification) + '\n');
  }

  /**
   * 处理 stdout 缓冲区
   */
  private processBuffer(): void {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const response = JSON.parse(line) as JsonRpcResponse;

        if (response.id !== undefined && this.pendingRequests.has(response.id)) {
          const pending = this.pendingRequests.get(response.id)!;
          this.pendingRequests.delete(response.id);

          if (response.error) {
            pending.reject(new Error(response.error.message));
          } else {
            pending.resolve(response.result);
          }
        }
      } catch {
        // 非 JSON 行，忽略
      }
    }
  }
}
