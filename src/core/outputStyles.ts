/**
 * 输出风格系统
 * 支持多种响应风格切换，包括默认、解释型、学习型
 */

import fs from 'fs-extra';
import path from 'node:path';
import { loadPromptWithVars } from '../services/promptLoader.js';

/**
 * 输出风格类型
 */
export type OutputStyleName = 'default' | 'explanatory' | 'learning';

/**
 * 输出风格定义
 */
export interface OutputStyleDefinition {
  name: OutputStyleName;
  description: string;
  prompt: string;
  keepCodingInstructions: boolean;
}

/**
 * 当前输出风格（默认为 default）
 */
let currentOutputStyle: OutputStyleName = 'default';

/**
 * 内置输出风格
 */
const OUTPUT_STYLES: Record<OutputStyleName, OutputStyleDefinition> = {
  default: {
    name: 'default',
    description: '默认风格，极简回复',
    prompt: '',
    keepCodingInstructions: true,
  },

  explanatory: {
    name: 'explanatory',
    description: '解释型风格，提供教育性见解和实现选择说明',
    prompt: loadPromptWithVars('styles/explanatory.md', {}),
    keepCodingInstructions: true,
  },

  learning: {
    name: 'learning',
    description: '学习型风格，暂停让用户编写小段代码进行实践',
    prompt: loadPromptWithVars('styles/learning.md', {}),
    keepCodingInstructions: true,
  },
};

/**
 * 获取当前输出风格
 */
export function getCurrentOutputStyle(): OutputStyleName {
  return currentOutputStyle;
}

/**
 * 设置当前输出风格
 */
export function setCurrentOutputStyle(style: OutputStyleName): void {
  if (!(style in OUTPUT_STYLES)) {
    throw new Error(`未知的输出风格: ${style}`);
  }
  currentOutputStyle = style;
}

/**
 * 获取当前输出风格的提示词
 */
export function getOutputStylePrompt(): string {
  const style = OUTPUT_STYLES[currentOutputStyle];
  return style.prompt;
}

/**
 * 获取当前输出风格定义
 */
export function getCurrentOutputStyleDefinition(): OutputStyleDefinition {
  return OUTPUT_STYLES[currentOutputStyle];
}

/**
 * 获取所有可用的输出风格
 */
export function getAvailableOutputStyles(): OutputStyleDefinition[] {
  return Object.values(OUTPUT_STYLES);
}

/**
 * 列出输出风格（用于显示）
 */
export function listOutputStyles(): string {
  return Object.values(OUTPUT_STYLES)
    .map(style => `- ${style.name}: ${style.description}`)
    .join('\n');
}

/**
 * 从项目配置加载输出风格
 */
export function loadOutputStyleFromConfig(workdir: string): void {
  const configPath = path.join(workdir, '.ai-agent', 'settings.json');
  
  if (fs.existsSync(configPath)) {
    try {
      const config = fs.readJsonSync(configPath);
      if (config.outputStyle && config.outputStyle in OUTPUT_STYLES) {
        currentOutputStyle = config.outputStyle;
      }
    } catch {
      // 忽略配置读取错误
    }
  }
}

/**
 * 保存输出风格到项目配置
 */
export function saveOutputStyleToConfig(workdir: string, style: OutputStyleName): void {
  const configDir = path.join(workdir, '.ai-agent');
  const configPath = path.join(configDir, 'settings.json');
  
  fs.ensureDirSync(configDir);
  
  let config: Record<string, unknown> = {};
  if (fs.existsSync(configPath)) {
    try {
      config = fs.readJsonSync(configPath);
    } catch {
      // 忽略读取错误，使用空配置
    }
  }
  
  config.outputStyle = style;
  fs.writeJsonSync(configPath, config, { spaces: 2 });
}
