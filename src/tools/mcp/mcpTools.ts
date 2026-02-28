/**
 * MCP 工具定义
 * 提供 ListMcpResources 和 ReadMcpResource 工具
 */

import type { ToolDefinition } from '../../core/types.js';
import type { MCPRegistry } from '../../services/mcp/registry.js';

/**
 * ListMcpResources 工具定义
 */
export const LIST_MCP_RESOURCES_TOOL: ToolDefinition = {
  name: 'ListMcpResources',
  description: `列出 MCP 服务器提供的可用资源。

功能:
- 列出所有已连接 MCP 服务器的资源
- 可通过 server 参数过滤特定服务器
- 返回资源 URI、名称和描述`,
  input_schema: {
    type: 'object',
    properties: {
      server: {
        type: 'string',
        description: '指定 MCP 服务器名称（可选，不指定则列出所有服务器的资源）',
      },
    },
    required: [],
  },
};

/**
 * ReadMcpResource 工具定义
 */
export const READ_MCP_RESOURCE_TOOL: ToolDefinition = {
  name: 'ReadMcpResource',
  description: `读取 MCP 服务器的特定资源。

功能:
- 通过 URI 读取 MCP 服务器上的资源
- 返回资源的文本内容`,
  input_schema: {
    type: 'object',
    properties: {
      server: {
        type: 'string',
        description: 'MCP 服务器名称',
      },
      uri: {
        type: 'string',
        description: '资源 URI',
      },
    },
    required: ['server', 'uri'],
  },
};

/**
 * 获取 MCP 工具定义列表
 */
export function getMCPBuiltinTools(): ToolDefinition[] {
  return [LIST_MCP_RESOURCES_TOOL, READ_MCP_RESOURCE_TOOL];
}

/**
 * 执行 ListMcpResources
 */
export function runListMcpResources(
  registry: MCPRegistry,
  serverName?: string
): string {
  const allResources = registry.getAllResources();

  const resources = serverName
    ? allResources.filter(r => r.server === serverName)
    : allResources;

  if (resources.length === 0) {
    return serverName
      ? `MCP 服务器 "${serverName}" 没有可用资源`
      : '没有可用的 MCP 资源';
  }

  const result = resources.map(r => ({
    server: r.server,
    uri: r.uri,
    name: r.name,
    description: r.description || '',
  }));

  return JSON.stringify(result, null, 2);
}

/**
 * 执行 ReadMcpResource
 */
export async function runReadMcpResource(
  registry: MCPRegistry,
  serverName: string,
  uri: string
): Promise<string> {
  return await registry.readResource(serverName, uri);
}
