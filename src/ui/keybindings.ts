/**
 * 可配置按键映射系统
 *
 * 从硬编码 if-else 改为注册表模式，
 * 支持 keybindings.json 自定义按键映射。
 */

/**
 * 按键绑定定义
 */
export interface KeyBinding {
  /** 键名，如 "ctrl+a", "escape", "up", "tab", "shift+enter" */
  key: string;
  /** 动作名，如 "startOfLine", "cancel", "historyUp", "complete" */
  action: string;
  /** 可选条件，如 "inputEmpty", "hasPrefix:/" */
  when?: string;
}

/**
 * 默认按键映射
 */
export const DEFAULT_KEYBINDINGS: KeyBinding[] = [
  { key: 'escape', action: 'cancel' },
  { key: 'up', action: 'historyUp' },
  { key: 'down', action: 'historyDown' },
  { key: 'right', action: 'cursorRight' },
  { key: 'left', action: 'cursorLeft' },
  { key: 'delete', action: 'delete' },
  { key: 'shift+enter', action: 'newline' },
  { key: 'enter', action: 'submit' },
  { key: 'ctrl+c', action: 'cancel' },
  { key: 'ctrl+d', action: 'exit', when: 'inputEmpty' },
  { key: 'backspace', action: 'backspace' },
  { key: 'ctrl+a', action: 'startOfLine' },
  { key: 'ctrl+e', action: 'endOfLine' },
  { key: 'ctrl+u', action: 'deleteToLineStart' },
  { key: 'ctrl+k', action: 'deleteToLineEnd' },
  { key: 'ctrl+w', action: 'deleteWordBefore' },
  { key: 'tab', action: 'complete', when: 'hasPrefix:/' },
];

/**
 * 按键映射注册表
 */
export class KeybindingRegistry {
  private bindings: KeyBinding[];

  constructor(defaults: KeyBinding[], userOverrides?: KeyBinding[]) {
    // 先用默认，再用用户覆盖（按 key 匹配替换）
    this.bindings = [...defaults];
    if (userOverrides) {
      for (const override of userOverrides) {
        const idx = this.bindings.findIndex((b) => b.key === override.key && b.when === override.when);
        if (idx !== -1) {
          this.bindings[idx] = override;
        } else {
          this.bindings.push(override);
        }
      }
    }
  }

  /**
   * 从 Buffer 解析键名
   */
  parseKey(data: Buffer): string | null {
    const code = data[0];
    if (code === undefined) return null;

    // ESC 单独按下
    if (code === 27 && data.length === 1) {
      return 'escape';
    }

    // 方向键序列 (ESC [ A/B/C/D)
    if (code === 27 && data[1] === 91) {
      const arrow = data[2];
      if (arrow === 65) return 'up';
      if (arrow === 66) return 'down';
      if (arrow === 67) return 'right';
      if (arrow === 68) return 'left';

      // Delete键 (ESC [ 3 ~)
      if (data[2] === 51 && data[3] === 126) return 'delete';

      // Shift+Enter (CSI 序列: ESC[13;2u 或 ESC[27;2;13~)
      const keyStr = data.toString();
      if (keyStr.includes('[13;2u') || keyStr.includes('[27;2;13~')) {
        return 'shift+enter';
      }

      return null;
    }

    // Shift+Enter (非 CSI 格式的备用检测)
    if (code === 27 && data.length > 4) {
      const keyStr = data.toString();
      if (keyStr.includes('[13;2u') || keyStr.includes('[27;2;13~')) {
        return 'shift+enter';
      }
    }

    // Enter
    if (code === 13 || code === 10) return 'enter';

    // Ctrl+C
    if (code === 3) return 'ctrl+c';

    // Ctrl+D
    if (code === 4) return 'ctrl+d';

    // Ctrl+G
    if (code === 7) return 'ctrl+g';

    // Backspace
    if (code === 127 || code === 8) return 'backspace';

    // Ctrl+A
    if (code === 1) return 'ctrl+a';

    // Ctrl+E
    if (code === 5) return 'ctrl+e';

    // Ctrl+U
    if (code === 21) return 'ctrl+u';

    // Ctrl+K
    if (code === 11) return 'ctrl+k';

    // Ctrl+W
    if (code === 23) return 'ctrl+w';

    // Tab
    if (code === 9) return 'tab';

    // 可打印字符不映射为键名
    if (code >= 32) return null;

    return null;
  }

  /**
   * 获取动作名
   * @param key 键名
   * @param context 上下文条件（如 { inputEmpty: true, 'hasPrefix:/': true }）
   */
  getAction(key: string, context?: Record<string, boolean>): string | null {
    // 查找匹配的绑定（带 when 条件的优先）
    const matchesWithWhen = this.bindings.filter(
      (b) => b.key === key && b.when !== undefined
    );
    const matchesWithoutWhen = this.bindings.filter(
      (b) => b.key === key && b.when === undefined
    );

    // 先检查带条件的绑定
    for (const binding of matchesWithWhen) {
      if (binding.when && context?.[binding.when]) {
        return binding.action;
      }
    }

    // 再检查无条件的绑定
    for (const binding of matchesWithoutWhen) {
      return binding.action;
    }

    return null;
  }
}
