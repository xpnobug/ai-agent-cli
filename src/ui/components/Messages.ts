/**
 * 消息显示组件 - 各类提示消息
 */

import { getTheme, isAccessibilityMode } from '../theme.js';
import { STATUS_ICONS } from '../../core/constants.js';
import { renderMarkdown, isMarkdownContent } from '../markdown.js';

/**
 * 消息显示类
 */
export class Messages {
  /**
   * 打印输入提示符
   */
  static printPrompt(): void {
    const theme = getTheme();
    process.stdout.write(`\n${theme.provider.bold('>')} `);
  }

  /**
   * 打印 AI 响应头部
   */
  static printAIHeader(): void {
    console.log();
  }

  /**
   * 打印 AI 响应尾部（带耗时）
   */
  static printAIFooter(elapsed?: number): void {
    if (elapsed) {
      const theme = getTheme();
      console.log(theme.textDim(`\n  ⏱  ${elapsed.toFixed(2)}s`));
    }
    console.log();
  }

  /**
   * 打印成功消息
   */
  static printSuccess(message: string): void {
    if (isAccessibilityMode()) {
      console.log(`[成功] ${message}`);
      return;
    }
    const theme = getTheme();
    console.log(`${theme.success(STATUS_ICONS.success)} ${message}`);
  }

  /**
   * 打印错误消息
   */
  static printError(message: string): void {
    if (isAccessibilityMode()) {
      console.log(`\n[错误] ${message}`);
      return;
    }
    const theme = getTheme();
    console.log(`\n${theme.error.bold(`${STATUS_ICONS.error} 错误:`)} ${message}`);
  }

  /**
   * 打印警告消息
   */
  static printWarning(message: string): void {
    if (isAccessibilityMode()) {
      console.log(`[警告] ${message}`);
      return;
    }
    const theme = getTheme();
    console.log(`${theme.warning(`${STATUS_ICONS.warning} 警告:`)} ${message}`);
  }

  /**
   * 打印信息消息
   */
  static printInfo(message: string): void {
    if (isAccessibilityMode()) {
      console.log(`[信息] ${message}`);
      return;
    }
    const theme = getTheme();
    console.log(`${theme.info(STATUS_ICONS.info)} ${message}`);
  }

  /**
   * 打印退出消息
   */
  static printGoodbye(): void {
    const theme = getTheme();
    console.log(theme.textDim('\n再见！\n'));
  }

  /**
   * 打印分隔线
   */
  static printDivider(width = 50): void {
    const theme = getTheme();
    console.log(theme.borderDim('─'.repeat(width)));
  }

  /**
   * 打印 Markdown 格式的文本（带语法高亮）
   */
  static printMarkdown(text: string): void {
    if (isMarkdownContent(text)) {
      const rendered = renderMarkdown(text);
      process.stdout.write(rendered);
    } else {
      console.log(text);
    }
  }
}
