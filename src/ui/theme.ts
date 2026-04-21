/**
 * 主题系统
 *
 * - 语义色 token（claude/permission/planMode/suggestion 等）
 * - 6 个主题: dark/light/dark-ansi/light-ansi/dark-daltonized/light-daltonized
 * - auto 模式跟随系统深色/浅色
 * - 颜色格式: rgb(r,g,b) 或 ansi:colorName
 * - 保留旧 API 兼容层（getInkColors）
 */

import chalk from 'chalk';

// ─── Theme 类型  ───

export type Theme = {
  claude: string;
  claudeShimmer: string;
  permission: string;
  permissionShimmer: string;
  planMode: string;
  promptBorder: string;
  promptBorderShimmer: string;
  bashBorder: string;
  autoAccept: string;
  suggestion: string;
  remember: string;
  background: string;
  fastMode: string;
  fastModeShimmer: string;
  text: string;
  inverseText: string;
  inactive: string;
  inactiveShimmer: string;
  subtle: string;
  success: string;
  error: string;
  warning: string;
  warningShimmer: string;
  merged: string;
  diffAdded: string;
  diffRemoved: string;
  diffAddedDimmed: string;
  diffRemovedDimmed: string;
  diffAddedWord: string;
  diffRemovedWord: string;
  userMessageBackground: string;
  userMessageBackgroundHover: string;
  messageActionsBackground: string;
  selectionBg: string;
  bashMessageBackgroundColor: string;
  memoryBackgroundColor: string;
  red_FOR_SUBAGENTS_ONLY: string;
  blue_FOR_SUBAGENTS_ONLY: string;
  green_FOR_SUBAGENTS_ONLY: string;
  yellow_FOR_SUBAGENTS_ONLY: string;
  purple_FOR_SUBAGENTS_ONLY: string;
  orange_FOR_SUBAGENTS_ONLY: string;
  pink_FOR_SUBAGENTS_ONLY: string;
  cyan_FOR_SUBAGENTS_ONLY: string;
  rainbow_red: string;
  rainbow_orange: string;
  rainbow_yellow: string;
  rainbow_green: string;
  rainbow_blue: string;
  rainbow_indigo: string;
  rainbow_violet: string;
};

// ─── 主题名和设置 ───

export const THEME_NAMES = [
  'dark', 'light', 'light-daltonized', 'dark-daltonized', 'light-ansi', 'dark-ansi',
] as const;
export type ThemeName = (typeof THEME_NAMES)[number];

export const THEME_SETTINGS = ['auto', ...THEME_NAMES] as const;
export type ThemeSetting = (typeof THEME_SETTINGS)[number];

// ─── Dark Theme（默认） ───

const darkTheme: Theme = {
  claude: 'rgb(215,119,87)',
  claudeShimmer: 'rgb(235,159,127)',
  permission: 'rgb(177,185,249)',
  permissionShimmer: 'rgb(207,215,255)',
  planMode: 'rgb(72,150,140)',
  promptBorder: 'rgb(136,136,136)',
  promptBorderShimmer: 'rgb(166,166,166)',
  bashBorder: 'rgb(253,93,177)',
  autoAccept: 'rgb(175,135,255)',
  suggestion: 'rgb(177,185,249)',
  remember: 'rgb(177,185,249)',
  background: 'rgb(0,204,204)',
  fastMode: 'rgb(255,120,20)',
  fastModeShimmer: 'rgb(255,165,70)',
  text: 'rgb(255,255,255)',
  inverseText: 'rgb(0,0,0)',
  inactive: 'rgb(153,153,153)',
  inactiveShimmer: 'rgb(193,193,193)',
  subtle: 'rgb(80,80,80)',
  success: 'rgb(78,186,101)',
  error: 'rgb(255,107,128)',
  warning: 'rgb(255,193,7)',
  warningShimmer: 'rgb(255,223,57)',
  merged: 'rgb(175,135,255)',
  diffAdded: 'rgb(34,92,43)',
  diffRemoved: 'rgb(122,41,54)',
  diffAddedDimmed: 'rgb(71,88,74)',
  diffRemovedDimmed: 'rgb(105,72,77)',
  diffAddedWord: 'rgb(56,166,96)',
  diffRemovedWord: 'rgb(179,89,107)',
  userMessageBackground: 'rgb(55,55,55)',
  userMessageBackgroundHover: 'rgb(70,70,70)',
  messageActionsBackground: 'rgb(44,50,62)',
  selectionBg: 'rgb(38,79,120)',
  bashMessageBackgroundColor: 'rgb(65,60,65)',
  memoryBackgroundColor: 'rgb(55,65,70)',
  red_FOR_SUBAGENTS_ONLY: 'rgb(220,38,38)',
  blue_FOR_SUBAGENTS_ONLY: 'rgb(37,99,235)',
  green_FOR_SUBAGENTS_ONLY: 'rgb(22,163,74)',
  yellow_FOR_SUBAGENTS_ONLY: 'rgb(202,138,4)',
  purple_FOR_SUBAGENTS_ONLY: 'rgb(147,51,234)',
  orange_FOR_SUBAGENTS_ONLY: 'rgb(234,88,12)',
  pink_FOR_SUBAGENTS_ONLY: 'rgb(219,39,119)',
  cyan_FOR_SUBAGENTS_ONLY: 'rgb(8,145,178)',
  rainbow_red: 'rgb(235,95,87)',
  rainbow_orange: 'rgb(245,139,87)',
  rainbow_yellow: 'rgb(250,195,95)',
  rainbow_green: 'rgb(145,200,130)',
  rainbow_blue: 'rgb(130,170,220)',
  rainbow_indigo: 'rgb(155,130,200)',
  rainbow_violet: 'rgb(200,130,180)',
};

// ─── Light Theme ───

const lightTheme: Theme = {
  claude: 'rgb(215,119,87)',
  claudeShimmer: 'rgb(245,149,117)',
  permission: 'rgb(87,105,247)',
  permissionShimmer: 'rgb(137,155,255)',
  planMode: 'rgb(0,102,102)',
  promptBorder: 'rgb(153,153,153)',
  promptBorderShimmer: 'rgb(183,183,183)',
  bashBorder: 'rgb(255,0,135)',
  autoAccept: 'rgb(135,0,255)',
  suggestion: 'rgb(87,105,247)',
  remember: 'rgb(0,0,255)',
  background: 'rgb(0,153,153)',
  fastMode: 'rgb(255,106,0)',
  fastModeShimmer: 'rgb(255,150,50)',
  text: 'rgb(0,0,0)',
  inverseText: 'rgb(255,255,255)',
  inactive: 'rgb(102,102,102)',
  inactiveShimmer: 'rgb(142,142,142)',
  subtle: 'rgb(175,175,175)',
  success: 'rgb(44,122,57)',
  error: 'rgb(171,43,63)',
  warning: 'rgb(150,108,30)',
  warningShimmer: 'rgb(200,158,80)',
  merged: 'rgb(135,0,255)',
  diffAdded: 'rgb(105,219,124)',
  diffRemoved: 'rgb(255,168,180)',
  diffAddedDimmed: 'rgb(199,225,203)',
  diffRemovedDimmed: 'rgb(253,210,216)',
  diffAddedWord: 'rgb(47,157,68)',
  diffRemovedWord: 'rgb(209,69,75)',
  userMessageBackground: 'rgb(240,240,240)',
  userMessageBackgroundHover: 'rgb(252,252,252)',
  messageActionsBackground: 'rgb(232,236,244)',
  selectionBg: 'rgb(180,213,255)',
  bashMessageBackgroundColor: 'rgb(250,245,250)',
  memoryBackgroundColor: 'rgb(230,245,250)',
  red_FOR_SUBAGENTS_ONLY: 'rgb(220,38,38)',
  blue_FOR_SUBAGENTS_ONLY: 'rgb(37,99,235)',
  green_FOR_SUBAGENTS_ONLY: 'rgb(22,163,74)',
  yellow_FOR_SUBAGENTS_ONLY: 'rgb(202,138,4)',
  purple_FOR_SUBAGENTS_ONLY: 'rgb(147,51,234)',
  orange_FOR_SUBAGENTS_ONLY: 'rgb(234,88,12)',
  pink_FOR_SUBAGENTS_ONLY: 'rgb(219,39,119)',
  cyan_FOR_SUBAGENTS_ONLY: 'rgb(8,145,178)',
  rainbow_red: 'rgb(235,95,87)',
  rainbow_orange: 'rgb(245,139,87)',
  rainbow_yellow: 'rgb(250,195,95)',
  rainbow_green: 'rgb(145,200,130)',
  rainbow_blue: 'rgb(130,170,220)',
  rainbow_indigo: 'rgb(155,130,200)',
  rainbow_violet: 'rgb(200,130,180)',
};

// ─── ANSI Themes（16 色终端） ───

const darkAnsiTheme: Theme = {
  claude: 'ansi:redBright', claudeShimmer: 'ansi:yellowBright',
  permission: 'ansi:blueBright', permissionShimmer: 'ansi:blueBright',
  planMode: 'ansi:cyanBright', promptBorder: 'ansi:white',
  promptBorderShimmer: 'ansi:whiteBright', bashBorder: 'ansi:magentaBright',
  autoAccept: 'ansi:magentaBright', suggestion: 'ansi:blueBright',
  remember: 'ansi:blueBright', background: 'ansi:cyanBright',
  fastMode: 'ansi:redBright', fastModeShimmer: 'ansi:redBright',
  text: 'ansi:whiteBright', inverseText: 'ansi:black',
  inactive: 'ansi:white', inactiveShimmer: 'ansi:whiteBright',
  subtle: 'ansi:white', success: 'ansi:greenBright',
  error: 'ansi:redBright', warning: 'ansi:yellowBright',
  warningShimmer: 'ansi:yellowBright', merged: 'ansi:magentaBright',
  diffAdded: 'ansi:green', diffRemoved: 'ansi:red',
  diffAddedDimmed: 'ansi:green', diffRemovedDimmed: 'ansi:red',
  diffAddedWord: 'ansi:greenBright', diffRemovedWord: 'ansi:redBright',
  userMessageBackground: 'ansi:blackBright',
  userMessageBackgroundHover: 'ansi:white',
  messageActionsBackground: 'ansi:blackBright',
  selectionBg: 'ansi:blue',
  bashMessageBackgroundColor: 'ansi:black',
  memoryBackgroundColor: 'ansi:blackBright',
  red_FOR_SUBAGENTS_ONLY: 'ansi:redBright', blue_FOR_SUBAGENTS_ONLY: 'ansi:blueBright',
  green_FOR_SUBAGENTS_ONLY: 'ansi:greenBright', yellow_FOR_SUBAGENTS_ONLY: 'ansi:yellowBright',
  purple_FOR_SUBAGENTS_ONLY: 'ansi:magentaBright', orange_FOR_SUBAGENTS_ONLY: 'ansi:redBright',
  pink_FOR_SUBAGENTS_ONLY: 'ansi:magentaBright', cyan_FOR_SUBAGENTS_ONLY: 'ansi:cyanBright',
  rainbow_red: 'ansi:red', rainbow_orange: 'ansi:redBright',
  rainbow_yellow: 'ansi:yellow', rainbow_green: 'ansi:green',
  rainbow_blue: 'ansi:cyan', rainbow_indigo: 'ansi:blue',
  rainbow_violet: 'ansi:magenta',
};

const lightAnsiTheme: Theme = {
  ...darkAnsiTheme,
  text: 'ansi:black', inverseText: 'ansi:white',
  inactive: 'ansi:blackBright', inactiveShimmer: 'ansi:white',
  subtle: 'ansi:blackBright', suggestion: 'ansi:blue',
  permission: 'ansi:blue', permissionShimmer: 'ansi:blueBright',
  success: 'ansi:green', error: 'ansi:red', warning: 'ansi:yellow',
};

// ─── Daltonized Themes（色盲友好） ───

const darkDaltonizedTheme: Theme = {
  ...darkTheme,
  diffAdded: 'rgb(51,102,204)', diffRemoved: 'rgb(204,51,51)',
  diffAddedWord: 'rgb(51,153,255)', diffRemovedWord: 'rgb(255,102,102)',
  success: 'rgb(51,153,255)',
};

const lightDaltonizedTheme: Theme = {
  ...lightTheme,
  diffAdded: 'rgb(153,204,255)', diffRemoved: 'rgb(255,204,204)',
  diffAddedWord: 'rgb(51,102,204)', diffRemovedWord: 'rgb(153,51,51)',
  success: 'rgb(0,102,153)',
};

// ─── 主题查找 ───

export function getThemeByName(themeName: ThemeName): Theme {
  switch (themeName) {
    case 'light': return lightTheme;
    case 'light-ansi': return lightAnsiTheme;
    case 'dark-ansi': return darkAnsiTheme;
    case 'light-daltonized': return lightDaltonizedTheme;
    case 'dark-daltonized': return darkDaltonizedTheme;
    default: return darkTheme;
  }
}

// ─── auto 模式解析 ───

export function resolveThemeSetting(setting: ThemeSetting): ThemeName {
  if (setting !== 'auto') return setting;
  if (process.env.COLORFGBG) {
    const parts = process.env.COLORFGBG.split(';');
    const bg = parseInt(parts[parts.length - 1] ?? '', 10);
    if (!isNaN(bg) && bg < 8) return 'dark';
    if (!isNaN(bg) && bg >= 8) return 'light';
  }
  return 'dark';
}

// ─── 全局状态 ───

let currentThemeSetting: ThemeSetting = 'auto';
let currentThemeName: ThemeName = resolveThemeSetting('auto');
let currentTheme: Theme = getThemeByName(currentThemeName);

export function getTheme(): Theme {
  return currentTheme;
}

export function getThemeName(): ThemeName {
  return currentThemeName;
}

export function getAvailableThemes(): readonly string[] {
  return THEME_SETTINGS;
}

export function setTheme(name: string): boolean {
  if (THEME_SETTINGS.includes(name as ThemeSetting)) {
    currentThemeSetting = name as ThemeSetting;
    currentThemeName = resolveThemeSetting(currentThemeSetting);
    currentTheme = getThemeByName(currentThemeName);
    return true;
  }
  return false;
}

export function setThemeByProvider(_provider: string): void {
  // 保留接口兼容  不按 provider 切换主题
}

export function resetTheme(): void {
  currentThemeSetting = 'auto';
  currentThemeName = resolveThemeSetting('auto');
  currentTheme = getThemeByName(currentThemeName);
}

// ─── 颜色转换工具 ───

/** 将主题色字符串转为 Ink 可用的颜色值 */
export function themeColorToInk(themeColor: string): string {
  const rgbMatch = themeColor.match(/rgb\(\s?(\d+),\s?(\d+),\s?(\d+)\s?\)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]!, 10).toString(16).padStart(2, '0');
    const g = parseInt(rgbMatch[2]!, 10).toString(16).padStart(2, '0');
    const b = parseInt(rgbMatch[3]!, 10).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }
  const ansiMatch = themeColor.match(/^ansi:(\w+)$/);
  if (ansiMatch) return ansiMatch[1]!;
  return themeColor;
}

/** 将主题色字符串转为 chalk ANSI 转义序列 */
export function themeColorToAnsi(themeColor: string): string {
  const rgbMatch = themeColor.match(/rgb\(\s?(\d+),\s?(\d+),\s?(\d+)\s?\)/);
  if (rgbMatch) {
    const colored = chalk.rgb(
      parseInt(rgbMatch[1]!, 10),
      parseInt(rgbMatch[2]!, 10),
      parseInt(rgbMatch[3]!, 10),
    )('X');
    return colored.slice(0, colored.indexOf('X'));
  }
  return '\x1b[35m';
}

// ─── Ink 颜色便捷访问 ───

/**
 * 从当前主题生成 Ink 组件可直接使用的颜色对象。
 * 所有值为 Ink color prop 可接受的字符串（#hex 或 ansi 色名）。
 */
export function getInkColors() {
  const t = currentTheme;
  return {
    // 新语义 token
    claude: themeColorToInk(t.claude),
    claudeShimmer: themeColorToInk(t.claudeShimmer),
    permission: themeColorToInk(t.permission),
    permissionShimmer: themeColorToInk(t.permissionShimmer),
    planMode: themeColorToInk(t.planMode),
    promptBorder: themeColorToInk(t.promptBorder),
    bashBorder: themeColorToInk(t.bashBorder),
    suggestion: themeColorToInk(t.suggestion),
    text: themeColorToInk(t.text),
    inverseText: themeColorToInk(t.inverseText),
    inactive: themeColorToInk(t.inactive),
    subtle: themeColorToInk(t.subtle),
    success: themeColorToInk(t.success),
    error: themeColorToInk(t.error),
    warning: themeColorToInk(t.warning),
    merged: themeColorToInk(t.merged),
    background: themeColorToInk(t.background),
    fastMode: themeColorToInk(t.fastMode),
    remember: themeColorToInk(t.remember),
    diffAdded: themeColorToInk(t.diffAdded),
    diffRemoved: themeColorToInk(t.diffRemoved),
    diffAddedDimmed: themeColorToInk(t.diffAddedDimmed),
    diffRemovedDimmed: themeColorToInk(t.diffRemovedDimmed),
    diffAddedWord: themeColorToInk(t.diffAddedWord),
    diffRemovedWord: themeColorToInk(t.diffRemovedWord),
    userMessageBackground: themeColorToInk(t.userMessageBackground),
    bashMessageBackgroundColor: themeColorToInk(t.bashMessageBackgroundColor),
    memoryBackgroundColor: themeColorToInk(t.memoryBackgroundColor),
    // 旧 key → 新 token 映射（向后兼容，逐步废弃）
    primary: themeColorToInk(t.claude),
    secondary: themeColorToInk(t.suggestion),
    info: themeColorToInk(t.suggestion),
    border: themeColorToInk(t.promptBorder),
    borderDim: themeColorToInk(t.subtle),
    textDim: themeColorToInk(t.inactive),
    cursor: themeColorToInk(t.claude),
    heading: themeColorToInk(t.error),
  };
}

/** getInkColors 返回类型 */
export type InkColorMap = ReturnType<typeof getInkColors>;

export function isAccessibilityMode(): boolean {
  return process.env.AI_AGENT_ACCESSIBILITY === 'true';
}
