/**
 * Spinner 组件 - 加载动画
 */

import ora, { Ora } from 'ora';
import { getTheme, isAccessibilityMode } from '../theme.js';

/**
 * 通用 Spinner 类
 */
export class Spinner {
  private spinner: Ora | null = null;

  constructor(
    private text: string,
    private color: 'yellow' | 'cyan' | 'green' | 'blue' | 'magenta' = 'cyan'
  ) {}

  start(): void {
    const theme = getTheme();

    if (isAccessibilityMode()) {
      // 无障碍模式：使用静态文本替代动画
      console.log(`[处理中] ${this.text}`);
      return;
    }

    this.spinner = ora({
      text: theme.textDim(this.text),
      spinner: 'dots',
      color: this.color,
    }).start();
  }

  update(text: string): void {
    if (isAccessibilityMode()) {
      console.log(`[处理中] ${text}`);
      return;
    }
    if (this.spinner) {
      this.spinner.text = text;
    }
  }

  succeed(text?: string): void {
    if (isAccessibilityMode()) {
      if (text) console.log(`[OK] ${text}`);
      return;
    }
    if (this.spinner) {
      this.spinner.succeed(text);
      this.spinner = null;
    }
  }

  fail(text?: string): void {
    if (isAccessibilityMode()) {
      if (text) console.log(`[ERR] ${text}`);
      return;
    }
    if (this.spinner) {
      this.spinner.fail(text);
      this.spinner = null;
    }
  }

  stop(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }

  isSpinning(): boolean {
    return this.spinner?.isSpinning ?? false;
  }
}

/**
 * 思考动画 Spinner
 */
export class ThinkingSpinner extends Spinner {
  constructor() {
    super('思考中...', 'yellow');
  }
}

/**
 * 全局思考动画实例
 */
export const thinkingSpinner = new ThinkingSpinner();
