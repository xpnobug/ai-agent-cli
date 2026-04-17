/**
 * 终端 UI 图形符号常量
 *
 * 跨平台的单字符图标，用于状态条、spinner、指示器等。
 * 以 Unicode code point 注释标注，避免字体问题时查源文件。
 */

// 黑色圆点：macOS 下垂直对齐更好，但 Linux/Windows 的大多数字体不支持
const isDarwin = process.platform === 'darwin';
export const BLACK_CIRCLE = isDarwin ? '⏺' : '●';

// 通用点 / 符号
export const BULLET_OPERATOR = '∙'; // U+2219
export const TEARDROP_ASTERISK = '✻'; // U+273B

// 方向箭头
export const UP_ARROW = '\u2191'; // ↑
export const DOWN_ARROW = '\u2193'; // ↓

// 闪电 / 努力程度
export const LIGHTNING_BOLT = '\u21af'; // ↯ fast 模式指示
export const EFFORT_LOW = '\u25cb'; // ○
export const EFFORT_MEDIUM = '\u25d0'; // ◐
export const EFFORT_HIGH = '\u25cf'; // ●
export const EFFORT_MAX = '\u25c9'; // ◉

// 媒体 / 触发状态
export const PLAY_ICON = '\u25b6'; // ▶
export const PAUSE_ICON = '\u23f8'; // ⏸

// 订阅 / 通道指示
export const REFRESH_ARROW = '\u21bb'; // ↻
export const CHANNEL_ARROW = '\u2190'; // ←
export const INJECTED_ARROW = '\u2192'; // →
export const FORK_GLYPH = '\u2442'; // ⑂

// 状态 / 评审钻石
export const DIAMOND_OPEN = '\u25c7'; // ◇
export const DIAMOND_FILLED = '\u25c6'; // ◆
export const REFERENCE_MARK = '\u203b'; // ※

// 旗帜
export const FLAG_ICON = '\u2691'; // ⚑

// 块引用 & 粗横线
export const BLOCKQUOTE_BAR = '\u258e'; // ▎
export const HEAVY_HORIZONTAL = '\u2501'; // ━

// 桥接状态 spinner 帧
export const BRIDGE_SPINNER_FRAMES = [
  '\u00b7|\u00b7',
  '\u00b7/\u00b7',
  '\u00b7\u2014\u00b7',
  '\u00b7\\\u00b7',
] as const;
export const BRIDGE_READY_INDICATOR = '\u00b7\u2714\ufe0e\u00b7';
export const BRIDGE_FAILED_INDICATOR = '\u00d7';
