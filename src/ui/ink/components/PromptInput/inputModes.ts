/**
 * inputModes — 输入模式定义
 *
 * 功能：`!` 前缀切换 bash 模式。
 */

export type PromptInputMode = 'prompt' | 'bash' | 'plan';

/**
 * 在输入文本前添加模式字符
 */
export function prependModeCharacterToInput(
  input: string,
  mode: PromptInputMode,
): string {
  switch (mode) {
    case 'bash':
      return `!${input}`;
    default:
      return input;
  }
}

/**
 * 从输入文本推断模式
 */
export function getModeFromInput(input: string): PromptInputMode {
  if (input.startsWith('!')) {
    return 'bash';
  }
  return 'prompt';
}

/**
 * 去掉模式前缀，返回纯文本
 */
export function getValueFromInput(input: string): string {
  const mode = getModeFromInput(input);
  if (mode === 'prompt') {
    return input;
  }
  return input.slice(1);
}

/**
 * 判断字符是否为模式切换字符
 */
export function isInputModeCharacter(input: string): boolean {
  return input === '!';
}
