/**
 * MCP (Model Context Protocol) 类型定义
 */

/**
 * MCP 服务器配置
 */
export interface MCPServerConfig {
  /** 服务器名称 */
  name: string;
  /** 启动命令 */
  command: string;
  /** 命令参数 */
  args?: string[];
  /** 环境变量 */
  env?: Record<string, string>;
  /** 工作目录 */
  cwd?: string;
  /** 是否启用 */
  enabled?: boolean;
}

/**
 * MCP 工具定义
 */
export interface MCPToolDefinition {
  /** 工具名称 */
  name: string;
  /** 工具描述 */
  description: string;
  /** 输入参数 JSON Schema */
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * MCP 资源定义
 */
export interface MCPResource {
  /** 资源 URI */
  uri: string;
  /** 资源名称 */
  name: string;
  /** 资源描述 */
  description?: string;
  /** MIME 类型 */
  mimeType?: string;
}

/**
 * MCP 配置文件格式
 */
export interface MCPConfig {
  /** MCP 服务器列表 */
  mcpServers?: Record<string, {
    command: string;
    args?: string[];
    env?: Record<string, string>;
    cwd?: string;
    enabled?: boolean;
  }>;
}

/**
 * JSON-RPC 2.0 请求
 */
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

/**
 * JSON-RPC 2.0 响应
 */
export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * MCP 工具调用结果
 */
export interface MCPToolCallResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
    resource?: {
      uri: string;
      text?: string;
      blob?: string;
    };
  }>;
  isError?: boolean;
}

/**
 * MCP 资源读取结果
 */
export interface MCPResourceReadResult {
  contents: Array<{
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
  }>;
}
