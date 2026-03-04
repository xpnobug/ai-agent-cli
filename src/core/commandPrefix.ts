/**
 * Bash 命令前缀检测
 */

import type { ProtocolAdapter } from '../services/ai/adapters/base.js';
import type { Message } from './types.js';
import { generateUuid } from '../utils/uuid.js';
import { loadPromptWithVars } from '../services/promptLoader.js';

export type CommandPrefixResult =
  | {
      commandPrefix: string | null;
      commandInjectionDetected: false;
    }
  | { commandInjectionDetected: true };

export type CommandSubcommandPrefixResult = CommandPrefixResult & {
  subcommandPrefixes: Map<string, CommandPrefixResult>;
};

const PREFIX_CACHE = new Map<string, Promise<CommandPrefixResult | null>>();

function buildBashCommandPrefixDetectionPrompt(command: string): {
  systemPrompt: string;
  userPrompt: string;
} {
  return {
    systemPrompt: loadPromptWithVars('safety/command-prefix-system.md', {}),
    userPrompt: loadPromptWithVars('safety/command-prefix-user.md', { command }),
  };
}

function splitCommand(command: string): string[] {
  const parts: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let escape = false;

  const pushCurrent = () => {
    const trimmed = current.trim();
    if (trimmed) parts.push(trimmed);
    current = '';
  };

  for (let i = 0; i < command.length; i++) {
    const char = command[i]!;

    if (escape) {
      current += char;
      escape = false;
      continue;
    }

    if (char === '\\') {
      current += char;
      escape = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = null;
      }
      current += char;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }

    if (char === '\n' || char === ';') {
      pushCurrent();
      continue;
    }

    if (char === '&' && command[i + 1] === '&') {
      pushCurrent();
      i++;
      continue;
    }

    if (char === '|' && command[i + 1] === '|') {
      pushCurrent();
      i++;
      continue;
    }

    if (char === '|' || char === '&') {
      pushCurrent();
      continue;
    }

    current += char;
  }

  pushCurrent();
  return parts;
}

async function queryCommandPrefix(
  command: string,
  adapter: ProtocolAdapter,
  maxTokens: number
): Promise<string> {
  const { systemPrompt, userPrompt } = buildBashCommandPrefixDetectionPrompt(command);
  const messages: Message[] = [{ role: 'user', content: userPrompt, uuid: generateUuid() }];
  const response = await adapter.createMessage(systemPrompt, messages, [], maxTokens);
  const extracted = adapter.extractTextAndToolCalls(response);
  const raw = extracted.textBlocks.join('\n');

  const firstNonEmptyLine =
    raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? '';

  return firstNonEmptyLine.replace(/<[^>]+>/g, '').trim();
}

async function getCommandPrefix(
  command: string,
  adapter: ProtocolAdapter
): Promise<CommandPrefixResult | null> {
  const cacheKey = command.trim();
  if (!cacheKey) return null;

  if (!PREFIX_CACHE.has(cacheKey)) {
    const promise = (async () => {
      const prefix = await queryCommandPrefix(cacheKey, adapter, 128);

      if (!prefix) return null;
      if (prefix === 'command_injection_detected') {
        return { commandInjectionDetected: true } as CommandPrefixResult;
      }

      if (prefix === 'none' || prefix === 'git') {
        return { commandPrefix: null, commandInjectionDetected: false } as CommandPrefixResult;
      }

      if (!cacheKey.startsWith(prefix)) {
        return { commandInjectionDetected: true } as CommandPrefixResult;
      }

      return { commandPrefix: prefix, commandInjectionDetected: false } as CommandPrefixResult;
    })();

    PREFIX_CACHE.set(cacheKey, promise);
  }

  return PREFIX_CACHE.get(cacheKey) ?? null;
}

export async function getCommandSubcommandPrefix(
  command: string,
  adapter: ProtocolAdapter
): Promise<CommandSubcommandPrefixResult | null> {
  const subcommands = splitCommand(command);

  const [fullCommandPrefix, ...subcommandPrefixesResults] = await Promise.all([
    getCommandPrefix(command, adapter),
    ...subcommands.map(async (subcommand) => ({
      subcommand,
      prefix: await getCommandPrefix(subcommand, adapter),
    })),
  ]);

  if (!fullCommandPrefix) {
    return null;
  }

  const subcommandPrefixes = subcommandPrefixesResults.reduce(
    (acc, { subcommand, prefix }) => {
      if (prefix) {
        acc.set(subcommand, prefix);
      }
      return acc;
    },
    new Map<string, CommandPrefixResult>()
  );

  return {
    ...fullCommandPrefix,
    subcommandPrefixes,
  };
}
