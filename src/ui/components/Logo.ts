/**
 * Logo 组件 - ASCII Logo 渲染
 */

import { getTheme } from '../theme.js';
import { ASCII_LOGO } from '../../core/constants.js';

/**
 * Logo 渲染类
 */
export class Logo {
  /**
   * 获取带颜色的 Logo 行
   */
  static getColoredLines(): string[] {
    const theme = getTheme();
    return ASCII_LOGO.map(line => theme.primary(line));
  }

  /**
   * 打印 Logo
   */
  static print(): void {
    const lines = this.getColoredLines();
    lines.forEach(line => console.log(line));
  }

  /**
   * 获取 Logo 宽度
   */
  static getWidth(): number {
    return Math.max(...ASCII_LOGO.map(line => line.length));
  }
}
