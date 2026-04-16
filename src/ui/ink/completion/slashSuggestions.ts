/**
 * 斜杠命令补全建议生成
 *
 * 每个建议包含 displayValue + description，用于双列布局。
 */

import type { SlashCommandItem, UnifiedSuggestion } from './types.js';

export function generateSlashCommandSuggestions(args: {
  commands: SlashCommandItem[];
  prefix: string;
}): UnifiedSuggestion[] {
  const { commands, prefix } = args;
  const filtered = commands.filter((cmd) => !cmd.isHidden);

  if (!prefix) {
    return filtered.map((cmd) => ({
      value: cmd.name,
      displayValue: `/${cmd.name}`,
      description: cmd.description,
      type: 'command' as const,
      score: 100,
    }));
  }

  return filtered
    .filter((cmd) => {
      const names = [cmd.name, ...(cmd.aliases || [])];
      return names.some((name) =>
        name.toLowerCase().startsWith(prefix.toLowerCase())
      );
    })
    .map((cmd) => ({
      value: cmd.name,
      displayValue: `/${cmd.name}`,
      description: cmd.description,
      type: 'command' as const,
      score:
        100 -
        prefix.length +
        (cmd.name.startsWith(prefix) ? 10 : 0),
    }));
}
