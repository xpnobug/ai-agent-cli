/**
 * ACP 专用 MCP 客户端适配
 * - 支持 stdio/http/sse（基于 @modelcontextprotocol/sdk）
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { MCPToolDefinition, MCPResource } from '../services/mcp/types.js';
import type { ToolDefinition } from '../core/types.js';
import * as Protocol from './protocol.js';

export type AcpMcpWrappedClient = {
  name: string;
  type: 'stdio' | 'http' | 'sse';
  client: Client;
  tools: MCPToolDefinition[];
  resources: MCPResource[];
};

function normalizeHeaders(headers: Protocol.HttpHeader[] | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!Array.isArray(headers)) return out;
  for (const header of headers) {
    if (!header || typeof header.name !== 'string') continue;
    out[header.name] = typeof header.value === 'string' ? header.value : '';
  }
  return out;
}

export async function connectAcpMcpServers(
  servers: Protocol.McpServer[],
): Promise<AcpMcpWrappedClient[]> {
  const clients: AcpMcpWrappedClient[] = [];

  for (const server of servers) {
    if (!server || typeof server.name !== 'string') continue;
    const type = (server as any).type ?? 'stdio';

    let transport: any = null;
    if (type === 'stdio') {
      const command = 'command' in server ? server.command : '';
      const args = 'args' in server && Array.isArray(server.args) ? server.args : [];
      const env = 'env' in server && Array.isArray(server.env)
        ? Object.fromEntries(server.env.map(e => [e.name, e.value]))
        : undefined;
      transport = new StdioClientTransport({ command, args, env });
    } else if (type === 'http') {
      const url = (server as Protocol.McpServerHttp).url;
      const headers = normalizeHeaders((server as Protocol.McpServerHttp).headers);
      transport = new StreamableHTTPClientTransport(new URL(url), {
        requestInit: { headers },
      });
    } else if (type === 'sse') {
      const url = (server as Protocol.McpServerSse).url;
      const headers = normalizeHeaders((server as Protocol.McpServerSse).headers);
      transport = new SSEClientTransport(new URL(url), {
        // EventSourceInit 的类型未暴露 headers，这里显式透传用于鉴权
        eventSourceInit: { headers } as any,
        requestInit: { headers },
      });
    } else {
      continue;
    }

    const client = new Client({
      name: 'ai-agent-cli-acp',
      version: '1.0.0',
    });

    try {
      await client.connect(transport);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`ACP MCP 服务器 "${server.name}" 连接失败: ${msg}`);
      continue;
    }

    let tools: MCPToolDefinition[] = [];
    let resources: MCPResource[] = [];

    try {
      const toolsResult = await client.listTools();
      tools = (toolsResult?.tools ?? []).map((tool: any) => ({
        name: String(tool.name),
        description: tool.description ? String(tool.description) : '',
        inputSchema: {
          type: 'object',
          properties: (tool.inputSchema?.properties as Record<string, unknown>) ?? {},
          required: Array.isArray(tool.inputSchema?.required) ? tool.inputSchema.required : [],
        },
      }));
    } catch {
      tools = [];
    }

    try {
      const resourcesResult = await client.listResources();
      resources = (resourcesResult?.resources ?? []).map((resource: any) => ({
        uri: String(resource.uri),
        name: String(resource.name),
        description: resource.description ? String(resource.description) : undefined,
        mimeType: resource.mimeType ? String(resource.mimeType) : undefined,
      }));
    } catch {
      resources = [];
    }

    clients.push({ name: server.name, type, client, tools, resources });
  }

  return clients;
}

export function buildAcpToolDefinitions(
  acpClients: AcpMcpWrappedClient[],
): ToolDefinition[] {
  const toolDefs: ToolDefinition[] = [];
  for (const wrapper of acpClients) {
    for (const tool of wrapper.tools) {
      toolDefs.push({
        name: `mcp__${wrapper.name}__${tool.name}`,
        description: `[MCP: ${wrapper.name}] ${tool.description || tool.name}`,
        input_schema: {
          type: 'object',
          properties: tool.inputSchema?.properties || {},
          required: tool.inputSchema?.required || [],
        },
      });
    }
  }
  return toolDefs;
}

export function listAcpResources(
  acpClients: AcpMcpWrappedClient[],
  serverName?: string,
): Array<MCPResource & { server: string }> {
  const resources: Array<MCPResource & { server: string }> = [];
  for (const wrapper of acpClients) {
    if (serverName && wrapper.name !== serverName) continue;
    for (const resource of wrapper.resources) {
      resources.push({ ...resource, server: wrapper.name });
    }
  }
  return resources;
}
