/**
 * 工具结果处理工具
 */

import type { ToolExecutionResult, ToolResultContent, ToolResultContentBlock } from './types.js';

export interface NormalizedToolExecutionResult {
  content: ToolResultContent;
  uiContent: string;
  isError: boolean;
}

function isErrorText(text: string): boolean {
  return text.startsWith('错误:') || text.startsWith('Error:') || text.startsWith('工具执行错误:');
}

export function normalizeToolExecutionResult(
  result: string | ToolExecutionResult
): NormalizedToolExecutionResult {
  if (typeof result === 'string') {
    return {
      content: result,
      uiContent: result,
      isError: isErrorText(result),
    };
  }

  const uiContent =
    result.uiContent ??
    (typeof result.content === 'string' ? result.content : '');

  return {
    content: result.content,
    uiContent,
    isError: result.isError ?? isErrorText(uiContent),
  };
}

export function toolResultContentToText(content: ToolResultContent): string {
  if (typeof content === 'string') {
    return content;
  }

  const textBlocks = content
    .filter((block): block is ToolResultContentBlock => block.type === 'text')
    .map((block) => ('text' in block ? block.text : ''))
    .filter((text) => text);

  if (textBlocks.length > 0) {
    return textBlocks.join('\n');
  }

  return '（非文本内容已省略）';
}
