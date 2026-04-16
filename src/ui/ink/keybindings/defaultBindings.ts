/**
 * keybindings/defaultBindings — 默认快捷键绑定
 *
 * 格式：{ context, bindings: { keyCombo: actionName } }
 */

import type { KeybindingBlock } from './types.js';
import { parseBindings } from './parser.js';
import type { ParsedBinding } from './types.js';

/** 默认快捷键配置块 */
export const DEFAULT_KEYBINDING_BLOCKS: KeybindingBlock[] = [
  {
    context: 'Global',
    bindings: {
      // 搜索
      '/': 'search:open',
      'ctrl+r': 'search:open',
      // 快速打开文件
      'ctrl+p': 'quickOpen:open',
      // 全局内容搜索
      'ctrl+shift+f': 'globalSearch:open',
      // 清屏
      'ctrl+l': 'clear:screen',
      // 帮助
      '?': 'help:toggle',
      // 转录模式（查看历史）
      'ctrl+o': 'transcript:toggle',
    },
  },
  {
    context: 'Chat',
    bindings: {
      escape: 'chat:cancel',
      'ctrl+c': 'chat:interrupt',
    },
  },
  {
    context: 'Scroll',
    bindings: {
      pageup: 'scroll:pageUp',
      pagedown: 'scroll:pageDown',
      wheelup: 'scroll:lineUp',
      wheeldown: 'scroll:lineDown',
      'ctrl+home': 'scroll:top',
      'ctrl+end': 'scroll:bottom',
      'ctrl+shift+c': 'selection:copy',
      'cmd+c': 'selection:copy',
    },
  },
  {
    context: 'Help',
    bindings: {
      escape: 'help:dismiss',
    },
  },
  {
    context: 'MessageSelector',
    bindings: {
      up: 'messageSelector:up',
      down: 'messageSelector:down',
      k: 'messageSelector:up',
      j: 'messageSelector:down',
      enter: 'messageSelector:select',
    },
  },
];

/** 解析后的默认绑定（缓存） */
let _parsed: ParsedBinding[] | null = null;

export function getDefaultBindings(): ParsedBinding[] {
  if (!_parsed) {
    _parsed = parseBindings(DEFAULT_KEYBINDING_BLOCKS);
  }
  return _parsed;
}
