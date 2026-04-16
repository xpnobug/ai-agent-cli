/**
 * PromptInput/utils — 输入工具函数
 *
 */

import type { Key } from '../../primitives.js';

/**
 * 判断按键是否为可打印非空白字符。
 * 用于在图片/粘贴 pill 后自动插入空格。
 */
export function isNonSpacePrintable(input: string, key: Key): boolean {
  if (
    key.ctrl ||
    key.meta ||
    key.escape ||
    key.return ||
    key.tab ||
    key.backspace ||
    key.delete ||
    key.upArrow ||
    key.downArrow ||
    key.leftArrow ||
    key.rightArrow ||
    key.pageUp ||
    key.pageDown
  ) {
    return false;
  }
  return input.length > 0 && !/^\s/.test(input) && !input.startsWith('\x1b');
}

/**
 * 获取换行操作的提示文本
 */
export function getNewlineInstructions(): string {
  // macOS 的 Apple Terminal 支持 Shift+Enter
  if (process.platform === 'darwin') {
    return 'Shift+Enter 换行';
  }
  return '\\+Enter 换行';
}
