/**
 * 斜杠命令注册系统
 * 提供统一的命令注册、匹配和执行机制
 */

import type { Message } from '../core/types.js';
import type { ContextCompressor } from '../core/contextCompressor.js';
import type { TokenTracker } from '../utils/tokenTracker.js';
import type { TaskListItem } from '../services/session/taskList.js';

/**
 * 命令上下文
 */
export interface SlashCommandContext {
  workdir: string;
  history: Message[];
  config: {
    provider: string;
    model: string;
    apiKey: string;
    baseUrl?: string;
    getProviderDisplayName: () => string;
  };
  userConfig: Record<string, unknown>;
  input: { getHistory: () => string[] };
  reminderManager: { reset: () => void };
  compressor?: ContextCompressor;
  systemPrompt?: string;
  tokenTracker?: TokenTracker;
  resumeSession?: (identifier?: string) => Promise<string | void>;
  requestTaskManager?: (tasks: TaskListItem[]) => Promise<{ action: 'output' | 'stop'; taskId: string } | null>;
  showToolResult?: (toolName: string, input: Record<string, unknown>, result: string, isError: boolean) => void;
}

/**
 * 斜杠命令定义
 */
export interface SlashCommand {
  name: string;
  aliases?: string[];
  description: string;
  execute: (args: string, context: SlashCommandContext) => Promise<string | void>;
}

/**
 * 命令执行结果
 */
export interface CommandResult {
  handled: boolean;
  output?: string;
}

/**
 * 命令注册表
 */
export class CommandRegistry {
  private commands = new Map<string, SlashCommand>();
  private aliasMap = new Map<string, string>(); // alias -> command name

  /**
   * 注册命令
   */
  register(cmd: SlashCommand): void {
    this.commands.set(cmd.name, cmd);

    if (cmd.aliases) {
      for (const alias of cmd.aliases) {
        this.aliasMap.set(alias, cmd.name);
      }
    }
  }

  /**
   * 执行命令
   */
  async execute(input: string, context: SlashCommandContext): Promise<CommandResult> {
    // 解析命令名和参数
    const trimmed = input.trim();
    if (!trimmed) return { handled: false };

    // 支持 "/command args" 和 "command args" 格式
    const parts = trimmed.split(/\s+/);
    const cmdName = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ');

    // 特殊处理 "config set" 这种两段式命令
    const twoPartCmd = parts.length >= 2 ? `${parts[0].toLowerCase()} ${parts[1].toLowerCase()}` : '';

    // 先尝试匹配两段式命令
    let command = this.findCommand(twoPartCmd);
    let finalArgs = parts.slice(2).join(' ');

    if (!command) {
      // 再尝试单段命令
      command = this.findCommand(cmdName);
      finalArgs = args;
    }

    if (!command) {
      return { handled: false };
    }

    const result = await command.execute(finalArgs, context);
    return {
      handled: true,
      output: result || undefined,
    };
  }

  /**
   * 查找命令
   */
  private findCommand(name: string): SlashCommand | undefined {
    // 直接匹配
    const direct = this.commands.get(name);
    if (direct) return direct;

    // 别名匹配
    const aliasTarget = this.aliasMap.get(name);
    if (aliasTarget) return this.commands.get(aliasTarget);

    return undefined;
  }

  /**
   * 获取帮助信息
   */
  getHelp(): string {
    const lines: string[] = ['\n可用命令:\n'];

    for (const [, cmd] of this.commands) {
      const aliases = cmd.aliases ? `, /${cmd.aliases.join(', /')}` : '';
      lines.push(`  /${cmd.name}${aliases}  - ${cmd.description}`);
    }

    lines.push('  exit, quit, q - 退出程序\n');
    return lines.join('\n');
  }

  /**
   * 获取所有已注册的命令
   */
  listCommands(): SlashCommand[] {
    return Array.from(this.commands.values());
  }

  /**
   * 获取所有命令名称（包含别名），用于 Tab 补全
   */
  getCommandNames(): string[] {
    const names: string[] = [];
    for (const [name, cmd] of this.commands) {
      names.push(name);
      if (cmd.aliases) {
        names.push(...cmd.aliases);
      }
    }
    return names.sort();
  }
}

// 单例
let registryInstance: CommandRegistry | null = null;

export function getCommandRegistry(): CommandRegistry {
  if (!registryInstance) {
    registryInstance = new CommandRegistry();
  }
  return registryInstance;
}
