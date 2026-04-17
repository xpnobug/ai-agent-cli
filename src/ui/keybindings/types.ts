/**
 * Keybindings 类型定义
 *
 * 对照源：claude-code-sourcemap/src/keybindings/types.ts（stub）
 * 此处根据 parser / match / resolver 等文件的使用，重建完整类型。
 */

/** 单个键击（包含修饰键） */
export interface ParsedKeystroke {
  /** 主键名（小写）：'a' / 'escape' / 'enter' / 'up' ... */
  key: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  /** Ink 把 Alt/Option 也报为 meta，和 alt 等价 */
  meta: boolean;
  /** Cmd / Super / Win —— 仅 kitty 协议终端可达 */
  super: boolean;
}

/** 和弦 = 有序键击序列（长度 1 即单键，>=2 即 "ctrl+k ctrl+s" 式组合） */
export type Chord = ParsedKeystroke[];

/** 上下文名（输入框 / 全局 / 菜单 等），字符串即可，不做强约束 */
export type KeybindingContextName = string;

/** 用户配置中一个 context 块 */
export interface KeybindingBlock {
  context: KeybindingContextName;
  /** key 为原始快捷键字符串，如 "ctrl+k"；值为动作名或 null（禁用） */
  bindings: Record<string, string | null>;
}

/** 解析后的绑定项 */
export interface ParsedBinding {
  chord: Chord;
  /** 动作名，如 'app:toggleTranscript'；null 表示禁用（解除绑定） */
  action: string | null;
  context: KeybindingContextName;
}
