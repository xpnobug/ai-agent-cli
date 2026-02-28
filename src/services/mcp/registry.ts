/**
 * MCP 注册表
 * 管理多个 MCP 客户端，提供统一的工具和资源访问接口
 */

import fs from 'fs-extra';
import path from 'node:path';
import { MCPClient } from './client.js';
import type { MCPConfig, MCPServerConfig, MCPToolDefinition, MCPResource } from './types.js';
import type { ToolDefinition } from '../../core/types.js';

/**
 * MCP 工具名称前缀
 */
const MCP_TOOL_PREFIX = 'mcp__';

/**
 * MCP 注册表
 */
export class MCPRegistry {
  private clients = new Map<string, MCPClient>();
  private workdir: string;

  constructor(workdir: string) {
    this.workdir = workdir;
  }

  /**
   * 从配置文件加载
   */
  async loadConfig(): Promise<void> {
    const config = this.findConfig();
    if (!config?.mcpServers) return;

    for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
      if (serverConfig.enabled === false) continue;

      const mcpConfig: MCPServerConfig = {
        name,
        command: serverConfig.command,
        args: serverConfig.args,
        env: serverConfig.env,
        cwd: serverConfig.cwd || this.workdir,
      };

      this.clients.set(name, new MCPClient(mcpConfig));
    }
  }

  /**
   * 连接所有服务器
   */
  async connectAll(): Promise<void> {
    const connectPromises: Promise<void>[] = [];

    for (const [name, client] of this.clients) {
      connectPromises.push(
        client.connect().catch((error: unknown) => {
          const msg = error instanceof Error ? error.message : String(error);
          console.warn(`MCP 服务器 "${name}" 连接失败: ${msg}`);
        })
      );
    }

    await Promise.allSettled(connectPromises);
  }

  /**
   * 断开所有服务器
   */
  disconnectAll(): void {
    for (const client of this.clients.values()) {
      client.disconnect();
    }
  }

  /**
   * 获取所有已连接的 MCP 工具（转换为 ToolDefinition 格式）
   */
  getAllTools(): ToolDefinition[] {
    const tools: ToolDefinition[] = [];

    for (const [serverName, client] of this.clients) {
      if (!client.isConnected()) continue;

      for (const mcpTool of client.listTools()) {
        tools.push(this.convertTool(serverName, mcpTool));
      }
    }

    return tools;
  }

  /**
   * 获取所有已连接的 MCP 资源
   */
  getAllResources(): Array<MCPResource & { server: string }> {
    const resources: Array<MCPResource & { server: string }> = [];

    for (const [serverName, client] of this.clients) {
      if (!client.isConnected()) continue;

      for (const resource of client.listResources()) {
        resources.push({ ...resource, server: serverName });
      }
    }

    return resources;
  }

  /**
   * 执行 MCP 工具
   */
  async executeTool(toolName: string, input: Record<string, unknown>): Promise<string> {
    const { serverName, originalName } = this.parseToolName(toolName);

    const client = this.clients.get(serverName);
    if (!client) {
      return `错误: MCP 服务器 "${serverName}" 不存在`;
    }

    if (!client.isConnected()) {
      return `错误: MCP 服务器 "${serverName}" 未连接`;
    }

    try {
      const result = await client.callTool(originalName, input);

      if (result.isError) {
        const errorText = result.content
          .filter(c => c.type === 'text')
          .map(c => c.text)
          .join('\n');
        return `错误: ${errorText || 'MCP 工具执行失败'}`;
      }

      // 提取文本内容
      const textParts: string[] = [];
      for (const content of result.content) {
        if (content.type === 'text' && content.text) {
          textParts.push(content.text);
        } else if (content.type === 'resource' && content.resource?.text) {
          textParts.push(content.resource.text);
        }
      }

      return textParts.join('\n') || '(无输出)';
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      return `MCP 工具执行错误: ${msg}`;
    }
  }

  /**
   * 读取 MCP 资源
   */
  async readResource(serverName: string, uri: string): Promise<string> {
    const client = this.clients.get(serverName);
    if (!client) {
      return `错误: MCP 服务器 "${serverName}" 不存在`;
    }

    if (!client.isConnected()) {
      return `错误: MCP 服务器 "${serverName}" 未连接`;
    }

    try {
      const result = await client.readResource(uri);

      const textParts: string[] = [];
      for (const content of result.contents) {
        if (content.text) {
          textParts.push(content.text);
        }
      }

      return textParts.join('\n') || '(无内容)';
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      return `MCP 资源读取错误: ${msg}`;
    }
  }

  /**
   * 列出已注册的服务器
   */
  listServers(): Array<{ name: string; connected: boolean; tools: number; resources: number }> {
    const result: Array<{ name: string; connected: boolean; tools: number; resources: number }> = [];

    for (const [name, client] of this.clients) {
      result.push({
        name,
        connected: client.isConnected(),
        tools: client.listTools().length,
        resources: client.listResources().length,
      });
    }

    return result;
  }

  /**
   * 是否有已注册的服务器
   */
  hasServers(): boolean {
    return this.clients.size > 0;
  }

  /**
   * 查找配置文件
   */
  private findConfig(): MCPConfig | null {
    // 优先级: .mcp.json > .ai-agent/mcp.json
    const candidates = [
      path.join(this.workdir, '.mcp.json'),
      path.join(this.workdir, '.ai-agent', 'mcp.json'),
    ];

    for (const candidate of candidates) {
      try {
        if (fs.existsSync(candidate)) {
          const content = fs.readFileSync(candidate, 'utf-8');
          return JSON.parse(content) as MCPConfig;
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  /**
   * 将 MCP 工具转换为内部 ToolDefinition
   */
  private convertTool(serverName: string, mcpTool: MCPToolDefinition): ToolDefinition {
    const name = `${MCP_TOOL_PREFIX}${serverName}__${mcpTool.name}`;

    return {
      name,
      description: `[MCP: ${serverName}] ${mcpTool.description}`,
      input_schema: {
        type: 'object',
        properties: mcpTool.inputSchema?.properties || {},
        required: mcpTool.inputSchema?.required || [],
      },
    };
  }

  /**
   * 解析 MCP 工具名称
   */
  private parseToolName(toolName: string): { serverName: string; originalName: string } {
    // 格式: mcp__serverName__toolName
    const withoutPrefix = toolName.slice(MCP_TOOL_PREFIX.length);
    const sepIndex = withoutPrefix.indexOf('__');

    if (sepIndex === -1) {
      return { serverName: withoutPrefix, originalName: '' };
    }

    return {
      serverName: withoutPrefix.slice(0, sepIndex),
      originalName: withoutPrefix.slice(sepIndex + 2),
    };
  }
}

/**
 * 判断工具名称是否为 MCP 工具
 */
export function isMCPTool(toolName: string): boolean {
  return toolName.startsWith(MCP_TOOL_PREFIX);
}
