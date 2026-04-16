/**
 * 补全相关类型（简化版，仅斜杠命令）
 */

export interface SlashCommandItem {
  name: string;
  description?: string;
  aliases?: string[];
  isHidden?: boolean;
}

export interface UnifiedSuggestion {
  value: string;
  displayValue: string;
  description?: string;
  type: 'command';
  score: number;
}

export interface CompletionContext {
  type: 'command';
  prefix: string;
  startPos: number;
  endPos: number;
}
