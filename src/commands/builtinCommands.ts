/**
 * 内置斜杠命令
 * 提取自 cli.ts 的命令逻辑，以 SlashCommand 对象形式注册
 */

import type { SlashCommand } from './registry.js';
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

/**
 * /help 命令
 */
export const helpCommand: SlashCommand = {
  name: 'help',
  aliases: ['h'],
  description: '显示帮助信息',
  async execute(_args, _context) {
    // 返回 undefined，由 registry.getHelp() 生成帮助内容
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
 * /config 命令
 */
export const configCommand: SlashCommand = {
  name: 'config',
  description: '查看当前配置',
  async execute(_args, context) {
    return '\n当前配置:\n' + getConfigSummary(context.userConfig as any) + '\n';
  },
};

/**
 * /config set 命令
 */
export const configSetCommand: SlashCommand = {
  name: 'config set',
  description: '重新配置',
  async execute(_args, _context) {
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
        context.history as any[],
        context.systemPrompt
      );

      // 替换历史
      context.history.splice(0, context.history.length);
      for (const msg of result.newHistory as any[]) {
        context.history.push(msg);
      }

      if (result.summary) {
        const leaf = [...result.newHistory].reverse().find((msg: any) => msg.role === 'assistant')?.uuid;
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
    const currentTokens = countTokensFromUsage(context.history as any[]);
    const maxTokens = getModelContextLength(
      context.userConfig.provider as string || context.config.provider,
      context.userConfig.model as string || context.config.model
    );

    const percentage = getTokenPercentage(currentTokens, maxTokens);
    const modelDisplay = getModelDisplayName(
      context.userConfig.model as string || context.config.model
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
 * /model 命令 - 显示/切换模型
 */
export const modelCommand: SlashCommand = {
  name: 'model',
  description: '查看当前模型',
  async execute(_args, context) {
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
          text = msg.content
            .filter((b: any) => b.type === 'text')
            .map((b: any) => b.text)
            .join('\n');
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
 * /export 命令 - 导出对话到文件
 */
export const exportCommand: SlashCommand = {
  name: 'export',
  description: '导出对话到文件 (md/json/txt)',
  async execute(args, context) {
    const format = (args || 'md').toLowerCase();
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
          text = (msg.content as any[])
            .filter((b: any) => b.type === 'text')
            .map((b: any) => b.text)
            .join('\n');
        }
        content += `[${role}]\n${text}\n\n`;
      }
    } else {
      // Markdown 格式
      content = `# 对话记录\n\n导出时间: ${new Date().toLocaleString('zh-CN')}\n\n---\n\n`;
      for (const msg of context.history) {
        const role = msg.role === 'user' ? '**用户**' : '**AI**';
        let text = '';
        if (typeof msg.content === 'string') {
          text = msg.content;
        } else if (Array.isArray(msg.content)) {
          text = (msg.content as any[])
            .filter((b: any) => b.type === 'text')
            .map((b: any) => b.text)
            .join('\n');
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
  },
};

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
    const currentTokens = countTokensFromUsage(context.history as any[]);
    const maxTokens = getModelContextLength(
      context.userConfig.provider as string || context.config.provider,
      context.userConfig.model as string || context.config.model
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
        for (const block of msg.content as any[]) {
          if (block.type === 'text') {
            msgTokens += Math.ceil(block.text.length / 4);
          } else if (block.type === 'tool_result') {
            const text = toolResultContentToText(block.content);
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
          const textBlock = (msg.content as any[]).find((b: any) => b.type === 'text');
          preview = textBlock ? textBlock.text.slice(0, 50) : '[工具调用/结果]';
        }
        lines.push(`  ${role} ${preview}${preview.length >= 50 ? '...' : ''}`);
      }
    }

    return lines.join('\n');
  },
};

/**
 * /theme 命令 - 切换主题
 */
export const themeCommand: SlashCommand = {
  name: 'theme',
  description: '查看或切换主题',
  async execute(args, context) {
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
    statuslineCommand,
  ];
}
