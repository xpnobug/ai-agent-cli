/**
 * 取一个动作在用户当前配置下的显示文本。
 *
 * 非 React 上下文使用；与 useShortcutDisplay（React hook）是一对。
 * 当查不到动作时回退给调用方提供的 fallback 字符串。
 */

import { getBindingDisplayText } from './resolver.js';
import type { KeybindingContextName, ParsedBinding } from './types.js';

/**
 * 查显示文本；找不到时返回 fallback。
 *
 * @param action 动作名（如 'app:toggleTranscript'）
 * @param context 键位上下文
 * @param fallback 未找到时的回退文本（常见为默认键位字符串，如 'ctrl+o'）
 * @param bindings 当前已加载的绑定；由调用方负责加载与缓存
 */
export function getShortcutDisplay(
  action: string,
  context: KeybindingContextName,
  fallback: string,
  bindings: ParsedBinding[],
): string {
  return getBindingDisplayText(action, context, bindings) ?? fallback;
}
