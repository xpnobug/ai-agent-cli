/**
 * UI 工具函数
 */

/**
 * 去除 ANSI 颜色码
 */
export function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * 判断字符是否为全角字符（中文、日文等）
 */
function isFullWidth(char: string): boolean {
  const code = char.charCodeAt(0);
  return (
    (code >= 0x1100 && code <= 0x115f) || // 韩文
    (code >= 0x2e80 && code <= 0xa4cf && code !== 0x303f) || // CJK
    (code >= 0xac00 && code <= 0xd7a3) || // 韩文音节
    (code >= 0xf900 && code <= 0xfaff) || // CJK 兼容
    (code >= 0xfe10 && code <= 0xfe1f) || // 竖排标点
    (code >= 0xfe30 && code <= 0xfe6f) || // CJK 兼容形式
    (code >= 0xff00 && code <= 0xff60) || // 全角 ASCII
    (code >= 0xffe0 && code <= 0xffe6) || // 全角符号
    (code >= 0x4e00 && code <= 0x9fff) || // CJK 统一汉字
    (code >= 0x3400 && code <= 0x4dbf) || // CJK 扩展 A
    (code >= 0x20000 && code <= 0x2a6df) || // CJK 扩展 B
    (code >= 0x2a700 && code <= 0x2b73f) || // CJK 扩展 C
    (code >= 0x2b740 && code <= 0x2b81f) || // CJK 扩展 D
    (code >= 0x3000 && code <= 0x303f) // CJK 标点
  );
}

/**
 * 获取字符串的显示宽度（考虑中文等全角字符）
 */
export function getDisplayWidth(str: string): number {
  const stripped = stripAnsi(str);
  let width = 0;
  for (const char of stripped) {
    width += isFullWidth(char) ? 2 : 1;
  }
  return width;
}

/**
 * 右填充字符串到指定显示宽度
 */
export function padRight(str: string, targetWidth: number): string {
  const currentWidth = getDisplayWidth(str);
  if (currentWidth >= targetWidth) return str;
  return str + ' '.repeat(targetWidth - currentWidth);
}

/**
 * 截断字符串到指定长度
 */
export function truncate(str: string, maxLength: number, suffix = '...'): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * 计算多行文本的最大显示宽度
 */
export function getMaxWidth(lines: string[]): number {
  return Math.max(...lines.map(getDisplayWidth));
}

/**
 * 居中文本到指定宽度
 */
export function centerText(str: string, targetWidth: number): string {
  const textWidth = getDisplayWidth(str);
  if (textWidth >= targetWidth) return str;
  const leftPad = Math.floor((targetWidth - textWidth) / 2);
  const rightPad = targetWidth - textWidth - leftPad;
  return ' '.repeat(leftPad) + str + ' '.repeat(rightPad);
}
