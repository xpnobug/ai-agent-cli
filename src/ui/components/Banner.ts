/**
 * Banner 组件 - 启动横幅
 */

import { getTheme } from '../theme.js';
import { PRODUCT_NAME, PRODUCT_VERSION, BORDER } from '../../core/constants.js';
import { Logo } from './Logo.js';
import { padRight, getMaxWidth, centerText } from '../utils.js';

/**
 * 最小宽度配置
 */
const MIN_LEFT_WIDTH = 42;
const MIN_RIGHT_WIDTH = 42;

/**
 * Banner 配置接口
 */
export interface BannerConfig {
  provider: string;
  providerDisplayName: string;
  model: string;
  workdir: string;
  skills: string[];
  agentTypes: string[];
}

/**
 * Banner 渲染类
 */
export class Banner {
  private config: BannerConfig;

  constructor(config: BannerConfig) {
    this.config = config;
  }

  /**
   * 构建左侧内容
   */
  private buildLeftContent(width: number): string[] {
    const theme = getTheme();
    const workdirName = this.config.workdir.split('/').pop() || 'workspace';

    return [
      '',
      theme.textBold('  Welcome back!'),
      '',
      ...Logo.getColoredLines(),
      '',
      centerText(theme.textDim(this.config.model), width),
      centerText(theme.textDim(`~/${workdirName}`), width),
      '',
    ];
  }

  /**
   * 构建右侧内容
   */
  private buildRightContent(): string[] {
    const theme = getTheme();
    const skillsStr = this.config.skills.length > 0
      ? this.config.skills.slice(0, 3).join(', ')
      : 'none';

    return [
      '',
      theme.error.bold('Tips for getting started'),
      theme.textDim('输入消息开始对话'),
      theme.textDim(`使用 'exit' 退出，Ctrl+C 中断`),
      '',
      theme.error.bold('Configuration'),
      theme.textDim(`Provider: ${this.config.providerDisplayName}`),
      theme.textDim(`Model: ${this.config.model.slice(0, 30)}`),
      theme.textDim(`Skills: ${skillsStr}`),
      '',
      theme.error.bold('Agent Types'),
      theme.textDim(`${this.config.agentTypes.join(' · ')}`),
      '',
    ];
  }

  /**
   * 构建双栏布局
   */
  private buildTwoColumnLayout(leftContent: string[], rightContent: string[], leftWidth: number, rightWidth: number): string[] {
    const theme = getTheme();
    const maxLines = Math.max(leftContent.length, rightContent.length);

    const lines: string[] = [];

    for (let i = 0; i < maxLines; i++) {
      const leftLine = leftContent[i] || '';
      const rightLine = rightContent[i] || '';
      const paddedLeft = padRight(leftLine, leftWidth);
      const paddedRight = padRight(rightLine, rightWidth);
      // 分隔符使用边框颜色
      lines.push(paddedLeft + theme.border(BORDER.separator) + paddedRight);
    }

    return lines;
  }

  /**
   * 渲染 Banner
   */
  render(): void {
    const theme = getTheme();
    
    // 先计算右侧内容宽度
    const rightContent = this.buildRightContent();
    const rightWidth = Math.max(getMaxWidth(rightContent), MIN_RIGHT_WIDTH);
    
    // 计算左侧宽度（基于 Logo 宽度）
    const logoWidth = Logo.getWidth();
    const leftWidth = Math.max(logoWidth + 4, MIN_LEFT_WIDTH);
    
    // 构建左侧内容（传入宽度用于居中）
    const leftContent = this.buildLeftContent(leftWidth);
    
    // 构建双栏布局
    const contentLines = this.buildTwoColumnLayout(leftContent, rightContent, leftWidth, rightWidth);

    const totalWidth = leftWidth + rightWidth + BORDER.separator.length;

    // 标题
    const title = ` ${PRODUCT_NAME} v${PRODUCT_VERSION} `;
    const borderLine = BORDER.horizontal.repeat(totalWidth + 2);
    const borderTop = `${BORDER.topLeft}${BORDER.horizontal}${title}${borderLine.slice(title.length + 1)}${BORDER.topRight}`;
    const borderBottom = `${BORDER.bottomLeft}${borderLine}${BORDER.bottomRight}`;

    // 输出
    console.log(theme.border(borderTop));
    contentLines.forEach(line => {
      console.log(theme.border(BORDER.vertical + ' ') + line + theme.border(' ' + BORDER.vertical));
    });
    console.log(theme.border(borderBottom));
    console.log();
  }

  /**
   * 静态工厂方法
   */
  static create(config: BannerConfig): Banner {
    return new Banner(config);
  }

  /**
   * 快捷渲染方法
   */
  static render(config: BannerConfig): void {
    new Banner(config).render();
  }
}
