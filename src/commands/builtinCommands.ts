/**
 * 内置斜杠命令
 * 提取自 cli.ts 的命令逻辑，以 SlashCommand 对象形式注册
 */

import type { SlashCommand, SlashCommandContext } from './registry.js';
import { getConfigSummary } from '../services/config/configStore.js';
import { runReconfigureWizard } from '../services/config/setup.js';
import { countTokensFromUsage, formatTokenCount, getTokenPercentage } from '../utils/tokenCounter.js';
import { toolResultContentToText } from '../core/toolResult.js';
import { getModelContextLength, getModelDisplayName } from '../utils/modelConfig.js';
import { getPermissionManager } from '../core/permissions.js';
import type { PermissionMode } from '../core/permissions.js';
import { getHookManager } from '../core/hooks.js';
import { PRODUCT_NAME, VERSION } from '../core/constants.js';
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTheme, getThemeName, getAvailableThemes, setThemeByProvider } from '../ui/index.js';
import { getStatusLineCommand, setStatusLineCommand } from '../services/ui/statusline.js';
import { appendSessionSummaryRecord } from '../services/session/sessionLog.js';
import { listTaskItems } from '../services/session/taskList.js';
import type { TaskListItem } from '../services/session/taskList.js';
import { runTaskOutput } from '../tools/system/taskOutput.js';
import { runTaskStop } from '../tools/filesystem/bash.js';
import type { Message, ToolResultBlock, Provider } from '../core/types.js';
import type { UserConfig } from '../services/config/configStore.js';

function isUserConfig(value: unknown): value is UserConfig {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.provider === 'string' &&
    typeof record.apiKey === 'string' &&
    typeof record.model === 'string'
  );
}

function getEffectiveUserConfig(context: { config: { provider: string; model: string; apiKey: string; baseUrl?: string }; userConfig: Record<string, unknown> }): UserConfig {
  if (isUserConfig(context.userConfig)) return context.userConfig;
  return {
    provider: context.config.provider as Provider,
    apiKey: context.config.apiKey,
    model: context.config.model,
    baseUrl: context.config.baseUrl,
  };
}

function extractTextFromContent(content: Message['content']): string {
  if (typeof content === 'string') return content;
  return content
    .filter((block): block is { type: 'text'; text: string } =>
      Boolean(block && block.type === 'text' && typeof block.text === 'string'))
    .map((block) => block.text)
    .join('\n');
}

function findFirstTextBlock(content: Message['content']): string | null {
  if (typeof content === 'string') return content;
  const block = content.find(
    (item): item is { type: 'text'; text: string } =>
      Boolean(item && item.type === 'text' && typeof item.text === 'string')
  );
  return block ? block.text : null;
}

/**
 * /help 命令 — 优先触发 HelpV2 UI 面板，回退纯文本
 */
export const helpCommand: SlashCommand = {
  name: 'help',
  aliases: ['h'],
  description: '显示帮助信息',
  async execute(_args, context) {
    if (context.setFocus && context.getAllCommands) {
      const commands = context.getAllCommands();
      return new Promise<string | void>((resolve) => {
        context.setFocus!({
          type: 'help_panel',
          commands,
          resolve: () => resolve(undefined),
        });
      });
    }
    return undefined;
  },
};

/**
 * /clear 命令
 */
export const clearCommand: SlashCommand = {
  name: 'clear',
  aliases: ['c'],
  description: '清空对话历史',
  async execute(_args, context) {
    context.history.splice(0, context.history.length);
    context.reminderManager.reset();
    return '对话历史已清空';
  },
};

/**
 * /config 命令 — 优先触发 Settings UI 面板，回退纯文本
 */
export const configCommand: SlashCommand = {
  name: 'config',
  description: '查看当前配置',
  async execute(_args, context) {
    if (context.setFocus) {
      const stats = context.tokenTracker?.getStats();
      return new Promise<string | void>((resolve) => {
        context.setFocus!({
          type: 'settings_panel',
          config: {
            provider: context.config.provider,
            model: context.config.model,
            apiKeySet: Boolean(context.config.apiKey),
            workdir: context.workdir,
          },
          usage: stats ? {
            totalTokens: stats.totalTokens,
            totalCost: stats.totalCost,
            sessionDuration: (Date.now() - (stats as any).startTime) / 1000 || 0,
            turns: context.history.filter(m => m.role === 'user').length,
          } : undefined,
          resolve: () => resolve(undefined),
        });
      });
    }
    const userConfig = getEffectiveUserConfig(context);
    return '\n当前配置:\n' + getConfigSummary(userConfig) + '\n';
  },
};

/**
 * /config set 命令 — 优先触发 ConfigSetDialog UI，回退到 enquirer 向导
 */
export const configSetCommand: SlashCommand = {
  name: 'config set',
  description: '重新配置',
  async execute(_args, context) {
    if (context.setFocus) {
      return new Promise<string | void>((resolve) => {
        context.setFocus!({
          type: 'config_set',
          currentProvider: context.config.provider,
          currentModel: context.config.model,
          resolve: (result) => {
            if (result) {
              resolve('配置已更新，请重新启动 CLI 以使用新配置。');
            } else {
              resolve(undefined);
            }
          },
        });
      });
    }
    // 回退：无 setFocus 时使用原 enquirer 向导
    const newConfig = await runReconfigureWizard();
    if (newConfig) {
      return '配置已更新，请重新启动 CLI 以使用新配置。';
    }
    return undefined;
  },
};

/**
 * /history 命令
 */
export const historyCommand: SlashCommand = {
  name: 'history',
  description: '显示输入历史',
  async execute(_args, context) {
    const inputHistory = context.input.getHistory();
    if (inputHistory.length === 0) {
      return '暂无输入历史';
    }

    const lines = ['输入历史:'];
    inputHistory.slice(0, 10).forEach((h: string, i: number) => {
      lines.push(`  ${i + 1}. ${h}`);
    });
    return lines.join('\n');
  },
};

/**
 * /resume 命令
 */
export const resumeCommand: SlashCommand = {
  name: 'resume',
  description: '恢复之前的会话',
  async execute(args, context) {
    if (!context.resumeSession) {
      return '当前界面不支持恢复会话';
    }
    return await context.resumeSession(args?.trim() || undefined);
  },
};

/**
 * /compact 命令 - 手动触发上下文压缩
 */
export const compactCommand: SlashCommand = {
  name: 'compact',
  description: '手动压缩对话上下文',
  async execute(_args, context) {
    if (!context.compressor || !context.systemPrompt) {
      return '上下文压缩功能未启用';
    }

    try {
      const result = await context.compressor.compact(
        context.history,
        context.systemPrompt
      );

      // 替换历史
      context.history.splice(0, context.history.length);
      for (const msg of result.newHistory) {
        context.history.push(msg);
      }

      if (result.summary) {
        const leaf = [...result.newHistory].reverse().find((msg) => msg.role === 'assistant')?.uuid;
        if (leaf) {
          appendSessionSummaryRecord({ summary: result.summary, leafUuid: leaf });
        }
      }

      return '上下文已压缩';
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return `压缩失败: ${errorMsg}`;
    }
  },
};

/**
 * /cost 命令 - 显示 token 用量
 */
export const costCommand: SlashCommand = {
  name: 'cost',
  description: '显示 Token 使用统计',
  async execute(_args, context) {
    // 优先使用 TokenTracker 精确数据
    if (context.tokenTracker) {
      return '\n' + context.tokenTracker.formatSummary();
    }

    // 回退到估算
    const currentTokens = countTokensFromUsage(context.history);
    const userConfig = isUserConfig(context.userConfig) ? context.userConfig : null;
    const maxTokens = getModelContextLength(
      userConfig?.provider || context.config.provider,
      userConfig?.model || context.config.model
    );

    const percentage = getTokenPercentage(currentTokens, maxTokens);
    const modelDisplay = getModelDisplayName(
      userConfig?.model || context.config.model
    );

    const lines = [
      `\nToken 使用统计 (估算):`,
      `  模型: ${modelDisplay}`,
      `  已使用: ${formatTokenCount(currentTokens)}`,
      `  上下文窗口: ${formatTokenCount(maxTokens)}`,
      `  使用率: ${percentage}%`,
    ];

    return lines.join('\n');
  },
};

/**
 * /model 命令 — 优先触发 ModelPicker UI，回退纯文本
 */
export const modelCommand: SlashCommand = {
  name: 'model',
  description: '查看或切换模型',
  async execute(_args, context) {
    if (context.setFocus) {
      return new Promise<string | void>((resolve) => {
        context.setFocus!({
          type: 'model_picker',
          currentModel: context.config.model,
          provider: context.config.provider,
          resolve: (model) => {
            if (model) {
              resolve(`模型已切换为: ${model}\n注意: 需要重启 CLI 生效。`);
            } else {
              resolve(undefined);
            }
          },
        });
      });
    }
    const modelDisplay = getModelDisplayName(context.config.model);
    return `当前模型: ${modelDisplay} (${context.config.provider})`;
  },
};

/**
 * /provider 命令 - 显示提供商
 */
export const providerCommand: SlashCommand = {
  name: 'provider',
  description: '查看当前提供商',
  async execute(_args, context) {
    return `当前提供商: ${context.config.getProviderDisplayName()} (${context.config.provider})`;
  },
};

/**
 * /permissions 命令 - 查看/修改权限模式
 */
export const permissionsCommand: SlashCommand = {
  name: 'permissions',
  aliases: ['perm'],
  description: '查看或修改权限模式',
  async execute(args, _context) {
    const pm = getPermissionManager();

    if (args) {
      const validModes: PermissionMode[] = [
        'ask', 'acceptEdits', 'bypassPermissions', 'plan', 'dontAsk', 'default',
      ];

      if (validModes.includes(args as PermissionMode)) {
        pm.setMode(args as PermissionMode);
        return `权限模式已切换为: ${args}`;
      }

      return `无效的权限模式: ${args}\n可用模式: ${validModes.join(', ')}`;
    }

    return pm.getSummary();
  },
};

/**
 * /hooks 命令 - 查看已配置的 Hook
 */
export const hooksCommand: SlashCommand = {
  name: 'hooks',
  description: '查看已配置的 Hook',
  async execute(_args, _context) {
    const hm = getHookManager();
    if (!hm) {
      return 'Hook 系统未初始化';
    }
    return hm.getSummary();
  },
};

/**
 * /copy 命令 - 复制最后一条 AI 响应到剪贴板
 */
export const copyCommand: SlashCommand = {
  name: 'copy',
  description: '复制最后一条 AI 响应到剪贴板',
  async execute(_args, context) {
    // 从后向前找最近的 assistant 消息
    for (let i = context.history.length - 1; i >= 0; i--) {
      const msg = context.history[i];
      if (msg.role === 'assistant') {
        let text = '';
        if (typeof msg.content === 'string') {
          text = msg.content;
        } else if (Array.isArray(msg.content)) {
          text = extractTextFromContent(msg.content);
        }

        if (!text) continue;

        try {
          // macOS: pbcopy, Linux: xclip
          const cmd = process.platform === 'darwin' ? 'pbcopy' : 'xclip -selection clipboard';
          execSync(cmd, { input: text });
          return `已复制 ${text.length} 个字符到剪贴板`;
        } catch {
          return '复制失败: 剪贴板工具不可用';
        }
      }
    }

    return '暂无可复制的 AI 响应';
  },
};

/**
 * /export 命令 — 优先触发 ExportDialog UI，回退纯文本导出
 */
export const exportCommand: SlashCommand = {
  name: 'export',
  description: '导出对话到文件 (md/json/txt)',
  async execute(args, context) {
    // 有 UI 时触发 ExportDialog
    if (context.setFocus && !args) {
      return new Promise<string | void>((resolve) => {
        context.setFocus!({
          type: 'export_dialog',
          resolve: (format) => {
            if (!format) { resolve(undefined); return; }
            doExport(format, context).then(resolve);
          },
        });
      });
    }
    // 直接带参数 or 回退
    const format = (args || 'md').toLowerCase();
    return doExport(format, context);
  },
};

/** 导出对话到文件的实际逻辑 */
async function doExport(format: string, context: SlashCommandContext): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `conversation-${timestamp}.${format}`;
    const filepath = join(context.workdir, filename);

    if (context.history.length === 0) {
      return '暂无对话内容可导出';
    }

    let content = '';

    if (format === 'json') {
      content = JSON.stringify(context.history, null, 2);
    } else if (format === 'txt') {
      for (const msg of context.history) {
        const role = msg.role === 'user' ? '用户' : 'AI';
        let text = '';
        if (typeof msg.content === 'string') {
          text = msg.content;
        } else if (Array.isArray(msg.content)) {
          text = extractTextFromContent(msg.content);
        }
        content += `[${role}]\n${text}\n\n`;
      }
    } else {
      content = `# 对话记录\n\n导出时间: ${new Date().toLocaleString('zh-CN')}\n\n---\n\n`;
      for (const msg of context.history) {
        const role = msg.role === 'user' ? '**用户**' : '**AI**';
        let text = '';
        if (typeof msg.content === 'string') {
          text = msg.content;
        } else if (Array.isArray(msg.content)) {
          text = extractTextFromContent(msg.content);
        }
        content += `### ${role}\n\n${text}\n\n---\n\n`;
      }
    }

    try {
      writeFileSync(filepath, content, 'utf-8');
      return `对话已导出到: ${filepath}`;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return `导出失败: ${errorMsg}`;
    }
}

/**
 * /status 命令 - 显示系统状态
 */
export const statusCommand: SlashCommand = {
  name: 'status',
  description: '显示版本/模型/API 状态',
  async execute(_args, context) {
    const modelDisplay = getModelDisplayName(context.config.model);
    const lines = [
      `\n${PRODUCT_NAME} v${VERSION}`,
      `  提供商: ${context.config.getProviderDisplayName()} (${context.config.provider})`,
      `  模型:   ${modelDisplay}`,
      `  工作目录: ${context.workdir}`,
      `  消息数: ${context.history.length}`,
    ];

    if (context.config.baseUrl) {
      lines.push(`  Base URL: ${context.config.baseUrl}`);
    }

    return lines.join('\n');
  },
};

/**
 * /context 命令 - 上下文使用可视化
 */
export const contextCommand: SlashCommand = {
  name: 'context',
  description: '上下文使用可视化',
  async execute(_args, context) {
    const currentTokens = countTokensFromUsage(context.history);
    const userConfig = isUserConfig(context.userConfig) ? context.userConfig : null;
    const maxTokens = getModelContextLength(
      userConfig?.provider || context.config.provider,
      userConfig?.model || context.config.model
    );

    const percentage = getTokenPercentage(currentTokens, maxTokens);

    // 生成进度条
    const barWidth = 30;
    const filledCount = Math.round((percentage / 100) * barWidth);
    const emptyCount = barWidth - filledCount;
    const bar = '█'.repeat(filledCount) + '░'.repeat(emptyCount);

    // 分类统计
    let systemTokens = 0;
    let userTokens = 0;
    let assistantTokens = 0;

    for (const msg of context.history) {
      let msgTokens = 0;
      if (typeof msg.content === 'string') {
        msgTokens = Math.ceil(msg.content.length / 4);
      } else if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === 'text') {
            msgTokens += Math.ceil(block.text.length / 4);
          } else if (block.type === 'tool_result') {
            const text = toolResultContentToText((block as ToolResultBlock).content);
            msgTokens += Math.ceil(text.length / 4);
          }
        }
      }

      if (msg.role === 'user') {
        userTokens += msgTokens;
      } else {
        assistantTokens += msgTokens;
      }
    }

    if (context.systemPrompt) {
      systemTokens = Math.ceil(context.systemPrompt.length / 4);
    }

    const lines = [
      `\n上下文使用: ${bar} ${percentage}% (${formatTokenCount(currentTokens)}/${formatTokenCount(maxTokens)})`,
      '',
      `  系统提示:  ${formatTokenCount(systemTokens)}`,
      `  用户消息:  ${formatTokenCount(userTokens)}`,
      `  AI 响应:   ${formatTokenCount(assistantTokens)}`,
      `  空闲:      ${formatTokenCount(Math.max(0, maxTokens - currentTokens))}`,
    ];

    return lines.join('\n');
  },
};

/**
 * /init 命令 - 初始化项目配置
 */
export const initCommand: SlashCommand = {
  name: 'init',
  description: '初始化项目配置文件',
  async execute(_args, context) {
    const { mkdirSync, existsSync } = await import('node:fs');
    const projectDir = join(context.workdir, '.ai-agent');
    const projectFile = join(projectDir, 'project.md');

    if (existsSync(projectFile)) {
      return `项目配置文件已存在: ${projectFile}`;
    }

    try {
      mkdirSync(projectDir, { recursive: true });
      const template = `# 项目说明\n\n在此描述你的项目，AI 将在每次对话中参考此文件。\n\n## 技术栈\n\n- \n\n## 项目结构\n\n- \n\n## 开发规范\n\n- \n`;
      writeFileSync(projectFile, template, 'utf-8');
      return `已创建项目配置文件: ${projectFile}`;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return `初始化失败: ${errorMsg}`;
    }
  },
};

/**
 * /debug 命令 - 显示调试信息
 */
export const debugCommand: SlashCommand = {
  name: 'debug',
  description: '显示调试信息',
  async execute(_args, context) {
    const memUsage = process.memoryUsage();
    const lines = [
      '\n调试信息:',
      `  Node.js: ${process.version}`,
      `  平台: ${process.platform} ${process.arch}`,
      `  内存 (RSS): ${(memUsage.rss / 1024 / 1024).toFixed(1)} MB`,
      `  内存 (Heap): ${(memUsage.heapUsed / 1024 / 1024).toFixed(1)}/${(memUsage.heapTotal / 1024 / 1024).toFixed(1)} MB`,
      `  PID: ${process.pid}`,
      `  消息历史: ${context.history.length} 条`,
      `  提供商: ${context.config.provider}`,
      `  模型: ${context.config.model}`,
    ];

    // 最近 3 条消息摘要
    if (context.history.length > 0) {
      lines.push('', '  最近消息:');
      const recent = context.history.slice(-3);
      for (const msg of recent) {
        const role = msg.role === 'user' ? '  [U]' : '  [A]';
        let preview = '';
        if (typeof msg.content === 'string') {
          preview = msg.content.slice(0, 50);
        } else if (Array.isArray(msg.content)) {
          const textBlock = findFirstTextBlock(msg.content);
          preview = textBlock ? textBlock.slice(0, 50) : '[工具调用/结果]';
        }
        lines.push(`  ${role} ${preview}${preview.length >= 50 ? '...' : ''}`);
      }
    }

    return lines.join('\n');
  },
};

/**
 * /theme 命令 — 优先触发 ThemePicker UI，回退纯文本
 */
export const themeCommand: SlashCommand = {
  name: 'theme',
  description: '查看或切换主题',
  async execute(args, context) {
    if (!args && context.setFocus) {
      return new Promise<string | void>((resolve) => {
        context.setFocus!({
          type: 'theme_picker',
          resolve: (theme) => {
            if (theme && setTheme(theme)) {
              setThemeByProvider(context.config.provider);
              resolve(`主题已切换为: ${theme}`);
            } else {
              resolve(undefined);
            }
          },
        });
      });
    }
    if (!args) {
      const current = getThemeName();
      const available = getAvailableThemes();
      return `当前主题: ${current}\n可用主题: ${available.join(', ')}`;
    }

    const themeName = args.trim().toLowerCase();
    if (setTheme(themeName)) {
      // 重新应用 provider 色
      setThemeByProvider(context.config.provider);
      return `主题已切换为: ${themeName}`;
    }

    const available = getAvailableThemes();
    return `无效主题: ${themeName}\n可用主题: ${available.join(', ')}`;
  },
};

/**
 * /mascot 命令 — 切换吉祥物
 */
export const mascotCommand: SlashCommand = {
  name: 'mascot',
  description: '查看或切换吉祥物',
  async execute(args, context) {
    const { getMascotRegistry, getMascotById } = await import('../ui/ink/components/LogoV2/mascots/index.js');
    const { saveUserConfig, loadUserConfig } = await import('../services/config/configStore.js');
    const registry = getMascotRegistry();
    const currentConfig = loadUserConfig();
    const currentMascot = currentConfig?.mascot ?? 'clawd';

    if (!args && context.setFocus) {
      return new Promise<string | void>((resolve) => {
        context.setFocus!({
          type: 'mascot_picker',
          currentMascot,
          resolve: (mascotId) => {
            if (mascotId && currentConfig) {
              saveUserConfig({ ...currentConfig, mascot: mascotId });
              resolve(`吉祥物已切换为: ${getMascotById(mascotId).name}`);
            } else {
              resolve(undefined);
            }
          },
        });
      });
    }

    if (!args) {
      const names = registry.map((m) => m.id).join(', ');
      return `当前吉祥物: ${getMascotById(currentMascot).name}\n可选: ${names}`;
    }

    const id = args.trim().toLowerCase();
    const mascot = registry.find((m) => m.id === id);
    if (mascot && currentConfig) {
      saveUserConfig({ ...currentConfig, mascot: id });
      return `吉祥物已切换为: ${mascot.name}`;
    }

    const names = registry.map((m) => m.id).join(', ');
    return `无效吉祥物: ${id}\n可选: ${names}`;
  },
};

/**
 * /statusline 命令 - 设置状态栏命令
 */
export const statuslineCommand: SlashCommand = {
  name: 'statusline',
  description: '设置或查看状态栏命令',
  async execute(args) {
    const trimmed = args.trim();
    if (!trimmed) {
      const current = getStatusLineCommand();
      if (!current) {
        return '当前未设置 statusline。\n用法: /statusline <命令> 或 /statusline off';
      }
      return `当前 statusline: ${current}\n用法: /statusline <命令> 或 /statusline off`;
    }

    if (['off', 'clear', 'disable'].includes(trimmed.toLowerCase())) {
      const ok = setStatusLineCommand(null);
      return ok ? '已清除 statusline。' : '错误: 未找到用户配置文件。';
    }

    const ok = setStatusLineCommand(trimmed);
    return ok ? `已设置 statusline: ${trimmed}` : '错误: 未找到用户配置文件。';
  },
};

/**
 * /tasks 命令 - 查看后台任务
 */
export const tasksCommand: SlashCommand = {
  name: 'tasks',
  description: '查看后台任务列表',
  async execute(_args, context) {
    const tasks = listTaskItems();

    if (tasks.length === 0) {
      return '当前没有后台任务';
    }

    if (!context.requestTaskManager) {
      return renderTasksAsText(tasks);
    }

    const selection = await context.requestTaskManager(tasks);
    if (!selection) {
      return '已取消';
    }

    if (selection.action === 'stop') {
      const result = await runTaskStop(selection.taskId);
      const isError = result.startsWith('错误:');
      if (context.showToolResult) {
        context.showToolResult('TaskStop', { task_id: selection.taskId }, result, isError);
        return undefined;
      }
      return result;
    }

    const output = await runTaskOutput(
      { task_id: selection.taskId, block: false },
      undefined
    );
    const text = output.uiContent ?? (typeof output.content === 'string' ? output.content : '');
    if (context.showToolResult) {
      context.showToolResult(
        'TaskOutput',
        { task_id: selection.taskId, block: false },
        text,
        Boolean(output.isError)
      );
      return undefined;
    }
    return text;
  },
};

function renderTasksAsText(tasks: TaskListItem[]): string {
  const lines: string[] = ['后台任务:'];

  for (const task of tasks) {
    const elapsed = task.completedAt
      ? ((task.completedAt - task.startedAt) / 1000).toFixed(1)
      : ((Date.now() - task.startedAt) / 1000).toFixed(1);
    const retrieved = task.taskType === 'agent' && task.retrieved ? ' · 已读取' : '';
    const typeLabel = task.taskType === 'bash' ? 'Bash' : '子代理';
    lines.push(`- ${task.id} · ${typeLabel} · ${task.status}${retrieved} · ${elapsed}s · ${task.description}`);
  }

  lines.push('提示: 让助手使用 TaskOutput 获取指定任务输出。');
  return lines.join('\n');
}

// ─── /doctor 诊断命令 ───

const doctorCommand: SlashCommand = {
  name: 'doctor',
  description: '运行诊断检查',
  execute: async (_args, context) => {
    // 有 UI 时触发 DiagnosticsDisplay
    if (context.setFocus) {
      const checks = buildDiagnosticChecks(context);
      return new Promise<string | void>((resolve) => {
        context.setFocus!({
          type: 'diagnostics',
          checks,
          resolve: () => resolve(undefined),
        });
      });
    }
    const lines: string[] = ['诊断检查:', ''];

    // Node.js 版本
    lines.push(`✓ Node.js ${process.version}`);
    lines.push(`✓ 平台: ${process.platform} ${process.arch}`);

    // Provider / Model
    const provider = context.config.provider;
    const model = context.config.model;
    const modelDisplay = getModelDisplayName(model);
    lines.push(`✓ Provider: ${provider}`);
    lines.push(`✓ Model: ${modelDisplay}`);

    // API Key
    const hasKey = Boolean(context.config.apiKey);
    lines.push(hasKey ? '✓ API Key: 已配置' : '✗ API Key: 未配置');

    // Base URL
    if (context.config.baseUrl) {
      lines.push(`✓ Base URL: ${context.config.baseUrl}`);
    }

    // 上下文窗口
    const contextLength = getModelContextLength(provider, model);
    lines.push(`✓ 上下文窗口: ${(contextLength / 1000).toFixed(0)}k tokens`);

    // 工作目录
    lines.push(`✓ 工作目录: ${context.workdir}`);

    // 配置文件
    const configDir = join(process.env['HOME'] || '~', '.ai-agent-cli');
    lines.push(`✓ 配置目录: ${configDir}`);

    // 内存
    const mem = process.memoryUsage();
    lines.push(`✓ 内存使用: ${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB / ${(mem.heapTotal / 1024 / 1024).toFixed(1)} MB`);

    // MCP 服务器
    try {
      const mcpConfig = join(configDir, 'mcp.json');
      const { readFileSync } = await import('node:fs');
      const mcpData = JSON.parse(readFileSync(mcpConfig, 'utf-8'));
      const serverCount = Object.keys(mcpData.mcpServers || {}).length;
      lines.push(serverCount > 0
        ? `✓ MCP 服务器: ${serverCount} 个已配置`
        : '○ MCP 服务器: 未配置');
    } catch {
      lines.push('○ MCP 服务器: 未配置');
    }

    lines.push('', `${PRODUCT_NAME} v${VERSION}`);
    return lines.join('\n');
  },
};

// ─── /memory 记忆管理命令 ───

const memoryCommand: SlashCommand = {
  name: 'memory',
  description: '查看/管理项目记忆文件',
  execute: async (args, context) => {
    const { readdirSync, readFileSync, rmSync, existsSync, mkdirSync } = await import('node:fs');

    const memoryDir = join(context.workdir, '.ai-agent', 'memory');

    if (!existsSync(memoryDir)) {
      mkdirSync(memoryDir, { recursive: true });
    }

    const subcommand = args.trim().split(/\s+/)[0] || '';
    const rest = args.trim().slice(subcommand.length).trim();

    if (subcommand === 'clear') {
      const files = readdirSync(memoryDir).filter((f: string) => f.endsWith('.md'));
      for (const f of files) {
        rmSync(join(memoryDir, f));
      }
      return `已清除 ${files.length} 个记忆文件。`;
    }

    if (subcommand === 'show' && rest) {
      const filePath = join(memoryDir, rest.endsWith('.md') ? rest : `${rest}.md`);
      if (!existsSync(filePath)) {
        return `记忆文件不存在: ${rest}`;
      }
      return readFileSync(filePath, 'utf-8');
    }

    // 默认：列出所有记忆
    const files = existsSync(memoryDir)
      ? readdirSync(memoryDir).filter((f: string) => f.endsWith('.md'))
      : [];

    if (files.length === 0) {
      return '暂无记忆文件。\n\n提示: AI 助手会在对话中自动创建记忆文件到 .ai-agent/memory/';
    }

    const lines = ['项目记忆文件:', ''];
    for (const f of files) {
      const content = readFileSync(join(memoryDir, f), 'utf-8');
      const firstLine = content.split('\n').find((l: string) => l.trim()) || '(空)';
      lines.push(`  ${f.replace('.md', '')} — ${firstLine.slice(0, 60)}`);
    }
    lines.push('', '用法: /memory show <name> | /memory clear');
    return lines.join('\n');
  },
};

// ─── /model set 命令 ───

const modelSetCommand: SlashCommand = {
  name: 'model set',
  description: '切换模型',
  execute: async (args, context) => {
    const newModel = args.trim();
    if (!newModel) {
      return '用法: /model set <model-name>\n例如: /model set gpt-4o';
    }
    // 更新配置
    const userConfig = getEffectiveUserConfig(context);
    userConfig.model = newModel;
    const { saveUserConfig } = await import('../services/config/configStore.js');
    saveUserConfig(userConfig);
    const display = getModelDisplayName(newModel);
    return `模型已切换为: ${display}\n注意: 需要重启 CLI 生效。`;
  },
};

// ─── /mcp 命令 ───

const mcpCommand: SlashCommand = {
  name: 'mcp',
  description: '查看 MCP 服务器状态',
  execute: async (_args, context) => {
    const { readFileSync, existsSync } = await import('node:fs');
    const configPaths = [
      join(context.workdir, '.ai-agent-cli', 'mcp.json'),
      join(context.workdir, '.ai-agent', 'mcp.json'),
      join(process.env['HOME'] || '~', '.ai-agent-cli', 'mcp.json'),
    ];

    let config: { mcpServers?: Record<string, { command?: string; enabled?: boolean }> } | null = null;
    let configPath = '';
    for (const p of configPaths) {
      if (existsSync(p)) {
        try {
          config = JSON.parse(readFileSync(p, 'utf-8'));
          configPath = p;
          break;
        } catch { /* ignore */ }
      }
    }

    if (!config?.mcpServers || Object.keys(config.mcpServers).length === 0) {
      return 'MCP 服务器: 未配置\n\n提示: 在 .ai-agent-cli/mcp.json 中配置 MCP 服务器。';
    }

    const lines = ['MCP 服务器:', ''];
    for (const [name, server] of Object.entries(config.mcpServers)) {
      const enabled = server.enabled !== false;
      const status = enabled ? '✓' : '○';
      const cmd = server.command || '(未设置命令)';
      lines.push(`  ${status} ${name} — ${cmd}`);
    }
    lines.push('', `配置文件: ${configPath}`);
    return lines.join('\n');
  },
};

// ─── /vim 命令（骨架） ───

const vimCommand: SlashCommand = {
  name: 'vim',
  description: '切换 Vim 模式（开发中）',
  execute: async () => {
    return [
      'Vim 模式 (开发中)',
      '',
      '计划支持的功能:',
      '  - Normal/Insert/Visual 模式切换',
      '  - h/j/k/l 光标移动',
      '  - dd/yy/p 行操作',
      '  - /pattern 搜索',
      '  - :w 保存 / :q 退出',
      '',
      '当前状态: 未实现',
    ].join('\n');
  },
};

// ─── 辅助函数：构建诊断检查项 ───

type DiagnosticCheck = { name: string; status: 'pass' | 'warn' | 'fail' | 'skip'; message?: string; detail?: string };

function buildDiagnosticChecks(context: SlashCommandContext): DiagnosticCheck[] {
  const checks: DiagnosticCheck[] = [];
  checks.push({ name: 'Node.js', status: 'pass', message: process.version });
  checks.push({ name: '平台', status: 'pass', message: `${process.platform} ${process.arch}` });
  checks.push({ name: 'Provider', status: 'pass', message: context.config.provider });
  checks.push({ name: 'Model', status: 'pass', message: getModelDisplayName(context.config.model) });
  checks.push({
    name: 'API Key',
    status: context.config.apiKey ? 'pass' : 'fail',
    message: context.config.apiKey ? '已配置' : '未配置',
  });
  if (context.config.baseUrl) {
    checks.push({ name: 'Base URL', status: 'pass', message: context.config.baseUrl });
  }
  const contextLength = getModelContextLength(context.config.provider, context.config.model);
  checks.push({ name: '上下文窗口', status: 'pass', message: `${(contextLength / 1000).toFixed(0)}k tokens` });
  checks.push({ name: '工作目录', status: 'pass', message: context.workdir });
  const mem = process.memoryUsage();
  checks.push({ name: '内存使用', status: mem.heapUsed > 500 * 1024 * 1024 ? 'warn' : 'pass', message: `${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB` });
  return checks;
}

// ─── /stats 命令 ───

const statsCommand: SlashCommand = {
  name: 'stats',
  description: '显示会话统计',
  execute: async (_args, context) => {
    if (context.setFocus && context.tokenTracker) {
      const s = context.tokenTracker.getStats();
      return new Promise<string | void>((resolve) => {
        context.setFocus!({
          type: 'stats_panel',
          data: {
            totalTokens: s.totalTokens,
            totalCost: s.totalCost,
            turns: context.history.filter(m => m.role === 'user').length,
            toolCalls: context.history.filter(m => m.role === 'assistant' && Array.isArray(m.content) && m.content.some((b: any) => b.type === 'tool_use')).length,
            durationSeconds: 0,
            model: context.config.model,
            provider: context.config.provider,
          },
          resolve: () => resolve(undefined),
        });
      });
    }
    // 回退到 /cost
    return costCommand.execute(_args, context);
  },
};

// ─── /output-style 命令 ───

const outputStyleCommand: SlashCommand = {
  name: 'output-style',
  description: '选择输出风格',
  execute: async (_args, context) => {
    if (context.setFocus) {
      return new Promise<string | void>((resolve) => {
        context.setFocus!({
          type: 'output_style_picker',
          currentStyle: 'normal',
          resolve: (style) => {
            if (style) resolve(`输出风格已切换为: ${style}`);
            else resolve(undefined);
          },
        });
      });
    }
    return '可用风格: concise / normal / explanatory / learning';
  },
};

// ─── /language 命令 ───

const languageCommand: SlashCommand = {
  name: 'language',
  aliases: ['lang'],
  description: '选择回复语言',
  execute: async (_args, context) => {
    if (context.setFocus) {
      return new Promise<string | void>((resolve) => {
        context.setFocus!({
          type: 'language_picker',
          currentLanguage: 'zh',
          resolve: (lang) => {
            if (lang) resolve(`语言已切换为: ${lang}`);
            else resolve(undefined);
          },
        });
      });
    }
    return '可用语言: zh / en / ja / ko / es / fr / de';
  },
};

// ─── /log-level 命令 ───

const logLevelCommand: SlashCommand = {
  name: 'log-level',
  description: '设置日志级别',
  execute: async (_args, context) => {
    if (context.setFocus) {
      return new Promise<string | void>((resolve) => {
        context.setFocus!({
          type: 'log_selector',
          currentLevel: 'info',
          resolve: (level) => {
            if (level) resolve(`日志级别已设置为: ${level}`);
            else resolve(undefined);
          },
        });
      });
    }
    return '可用级别: debug / info / warn / error / silent';
  },
};

/**
 * 获取所有内置命令
 */
export function getBuiltinCommands(): SlashCommand[] {
  return [
    helpCommand,
    clearCommand,
    configCommand,
    configSetCommand,
    historyCommand,
    resumeCommand,
    compactCommand,
    costCommand,
    modelCommand,
    providerCommand,
    permissionsCommand,
    hooksCommand,
    copyCommand,
    exportCommand,
    statusCommand,
    contextCommand,
    initCommand,
    debugCommand,
    themeCommand,
    mascotCommand,
    statuslineCommand,
    tasksCommand,
    doctorCommand,
    memoryCommand,
    modelSetCommand,
    mcpCommand,
    vimCommand,
    statsCommand,
    outputStyleCommand,
    languageCommand,
    logLevelCommand,
  ];
}
