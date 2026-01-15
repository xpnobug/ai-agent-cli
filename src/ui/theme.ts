/**
 * 主题系统 - 集中管理颜色和样式
 */

import chalk, { ChalkInstance } from 'chalk';

/**
 * 主题接口定义
 */
export interface Theme {
  // 品牌色
  primary: ChalkInstance;
  secondary: ChalkInstance;

  // 语义色
  success: ChalkInstance;
  error: ChalkInstance;
  warning: ChalkInstance;
  info: ChalkInstance;

  // 文本色
  text: ChalkInstance;
  textDim: ChalkInstance;
  textBold: ChalkInstance;

  // 边框色
  border: ChalkInstance;
  borderDim: ChalkInstance;

  // Provider 专属色
  provider: ChalkInstance;
}

/**
 * Provider 颜色映射
 */
const PROVIDER_COLORS: Record<string, ChalkInstance> = {
  anthropic: chalk.magenta,
  openai: chalk.green,
  gemini: chalk.blue,
};

/**
 * 默认主题
 */
const defaultTheme: Theme = {
  primary: chalk.hex('#FFC233'),
  secondary: chalk.cyan,

  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.blue,

  text: chalk.white,
  textDim: chalk.dim,
  textBold: chalk.bold,

  border: chalk.gray,
  borderDim: chalk.dim.gray,

  provider: chalk.cyan,
};

/**
 * 当前主题实例
 */
let currentTheme: Theme = { ...defaultTheme };

/**
 * 获取当前主题
 */
export function getTheme(): Theme {
  return currentTheme;
}

/**
 * 根据 provider 设置主题
 */
export function setThemeByProvider(provider: string): void {
  currentTheme = {
    ...defaultTheme,
    provider: PROVIDER_COLORS[provider] || chalk.cyan,
  };
}

/**
 * 重置为默认主题
 */
export function resetTheme(): void {
  currentTheme = { ...defaultTheme };
}
