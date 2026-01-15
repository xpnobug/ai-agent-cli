/**
 * AI Agent CLI 库入口
 * 导出公共 API 供外部使用
 */

// 核心类型
export type {
  Message,
  ContentBlock,
  TextBlock,
  ToolUseBlock,
  ToolResultBlock,
  ToolDefinition,
  ToolResult,
  ToolCall,
  ExecuteToolFunc,
  LLMResponse,
  Provider,
  AgentType,
} from '../core/types.js';

// 核心功能
export { agentLoop } from '../core/loop.js';
export { createSystemPrompt, createSubagentSystemPrompt } from '../core/prompts.js';
export { getReminderManager } from '../core/reminder.js';
export { getPlanModeManager } from '../core/planMode.js';
export { getProjectContextManager } from '../core/projectContext.js';

// 配置
export { getConfig } from '../services/config/Config.js';
export type { Config, ConfigOptions } from '../services/config/types.js';

// AI 适配器
export { createAdapter } from '../services/ai/adapters/factory.js';
export { ProtocolAdapter } from '../services/ai/adapters/base.js';

// 工具
export { ALL_TOOLS, BASE_TOOLS, getToolsForAgentType } from '../tools/definitions.js';
export { createExecuteTool } from '../tools/dispatcher.js';

// UI
export { Banner, Messages, getTheme, setThemeByProvider } from '../ui/index.js';
