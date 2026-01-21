/**
 * UI 模块统一导出
 */

// 主题
export { getTheme, setThemeByProvider, resetTheme } from './theme.js';
export type { Theme } from './theme.js';

// 常量
export {
  PRODUCT_NAME,
  PRODUCT_VERSION,
  ASCII_LOGO,
  TOOL_ICONS,
  DEFAULT_ICON,
  BORDER,
  STATUS_ICONS,
} from '../core/constants.js';

// 工具函数
export {
  stripAnsi,
  getDisplayWidth,
  padRight,
  truncate,
  getMaxWidth,
  centerText,
} from './utils.js';

// 组件
export { Logo } from './components/Logo.js';
export { Banner } from './components/Banner.js';
export type { BannerConfig } from './components/Banner.js';
export { Messages } from './components/Messages.js';
export { ToolDisplay, ToolSpinner } from './components/ToolDisplay.js';
export { Spinner, ThinkingSpinner, thinkingSpinner } from './components/Spinner.js';
export { Input } from './components/Input.js';
export type { InputConfig, InputResult } from './components/Input.js';
