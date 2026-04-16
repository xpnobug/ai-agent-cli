/**
 * ConfigurableShortcutHint — 可配置快捷键提示
 *
 * 功能：显示可自定义的快捷键提示，从键绑定配置中解析实际绑定。
 */

import React from 'react';
import { KeyboardShortcutHint } from './design-system/KeyboardShortcutHint.js';

type Props = {
  /** 快捷键动作名（如 'quickOpen:open'） */
  actionName: string;
  /** 显示的动作描述 */
  action: string;
  /** 默认快捷键（当无自定义绑定时使用） */
  defaultShortcut: string;
};

/**
 * 可配置快捷键提示。
 * 当用户自定义了快捷键时显示自定义绑定，否则显示默认值。
 */
export function ConfigurableShortcutHint({
  action,
  defaultShortcut,
}: Props): React.ReactNode {
  // 当前简化实现：直接使用默认快捷键
  // 后续可从 keybinding resolver 中查询实际绑定
  return (
    <KeyboardShortcutHint
      shortcut={defaultShortcut}
      action={action}
    />
  );
}
