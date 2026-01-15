/**
 * 工具显示组件 - 显示工具执行状态和结果
 */

import type { ChalkInstance } from 'chalk';
import { getTheme, Theme } from '../theme.js';
import { TOOL_ICONS, DEFAULT_ICON } from '../../core/constants.js';
import { truncate } from '../utils.js';
import { Spinner } from './Spinner.js';

/**
 * 工具颜色映射
 */
const TOOL_COLORS: Record<string, keyof Theme> = {
  bash: 'warning',
  read_file: 'info',
  write_file: 'success',
  edit_file: 'secondary',
  TodoWrite: 'secondary',
  Skill: 'secondary',
  Task: 'info',
};

/**
 * 工具显示类
 */
export class ToolDisplay {
  /**
   * 获取工具图标
   */
  static getIcon(toolName: string): string {
    return TOOL_ICONS[toolName] || DEFAULT_ICON;
  }

  /**
   * 获取工具颜色函数
   */
  static getColor(toolName: string): ChalkInstance {
    const theme = getTheme();
    const colorKey = TOOL_COLORS[toolName] || 'secondary';
    return theme[colorKey] as ChalkInstance;
  }

  /**
   * 打印工具开始执行
   */
  static printStart(toolName: string, detail?: string): void {
    const icon = this.getIcon(toolName);
    const color = this.getColor(toolName);
    const detailStr = detail ? getTheme().textDim(` (${truncate(detail, 50)})`) : '';

    console.log(`\n${color.bold(`${icon} ${toolName}`)}${detailStr}`);
  }

  /**
   * 打印工具结果摘要
   */
  static printResult(summary: string): void {
    const theme = getTheme();
    console.log(theme.textDim(`  └ ${summary}`));
  }

  /**
   * 打印工具输出（支持多行和截断）
   */
  static printOutput(output: string, options: {
    isError?: boolean;
    maxLines?: number;
    maxLineLength?: number;
  } = {}): void {
    if (!output) return;

    const { isError = false, maxLines = 10, maxLineLength = 100 } = options;
    const theme = getTheme();
    const lines = output.trim().split('\n');
    const style = isError ? theme.error : theme.textDim;

    for (const line of lines.slice(0, maxLines)) {
      const truncated = truncate(line, maxLineLength);
      console.log(`  ${theme.textDim('└')} ${style(truncated)}`);
    }

    if (lines.length > maxLines) {
      console.log(theme.textDim(`  └ ... (还有 ${lines.length - maxLines} 行)`));
    }
  }

  /**
   * 打印工具成功
   */
  static printSuccess(toolName: string, message: string): void {
    const icon = this.getIcon(toolName);
    const theme = getTheme();
    console.log(`${theme.success(`${icon} ${toolName}`)} ${theme.textDim(message)}`);
  }

  /**
   * 打印工具错误
   */
  static printError(toolName: string, error: string): void {
    const icon = this.getIcon(toolName);
    const theme = getTheme();
    console.log(`${theme.error(`${icon} ${toolName}`)} ${theme.error(error)}`);
  }
}

/**
 * 工具执行 Spinner
 */
export class ToolSpinner extends Spinner {
  constructor(toolName: string, detail?: string) {
    const icon = ToolDisplay.getIcon(toolName);
    const detailStr = detail ? ` (${detail})` : '';
    super(`${icon} ${toolName}${detailStr}`, 'cyan');
  }
}
