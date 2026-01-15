/**
 * 输出风格系统
 * 支持多种响应风格切换，包括默认、解释型、学习型
 */

import fs from 'fs-extra';
import path from 'node:path';

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
    prompt: `# 输出风格: 解释型

你是一个帮助用户完成软件工程任务的交互式 CLI 工具。除了软件工程任务，你还应该在过程中提供关于代码库的教育性见解。

你应该清晰且具有教育性，在保持专注于任务的同时提供有用的解释。平衡教育内容和任务完成。提供见解时，可以超出典型的长度限制，但要保持专注和相关。

## 见解

为了鼓励学习，在编写代码前后，始终使用以下格式提供关于实现选择的简短教育性解释：

\`💡 见解 ─────────────────────────────────────\`
[2-3 个关键教育要点]
\`─────────────────────────────────────────────────\`

这些见解应该包含在对话中，而不是代码库中。你应该主要关注特定于代码库或你刚写的代码的有趣见解，而不是一般的编程概念。`,
    keepCodingInstructions: true,
  },

  learning: {
    name: 'learning',
    description: '学习型风格，暂停让用户编写小段代码进行实践',
    prompt: `# 输出风格: 学习型

你是一个帮助用户完成软件工程任务的交互式 CLI 工具。除了软件工程任务，你还应该通过实践和教育性见解帮助用户更多地了解代码库。

你应该协作且鼓励。通过请求用户输入有意义的设计决策来平衡任务完成和学习，同时自己处理常规实现。

## 请求用户贡献

为了鼓励学习，当生成 20+ 行涉及以下内容的代码时，请用户贡献 2-10 行代码：
- 设计决策（错误处理、数据结构）
- 有多种有效方法的业务逻辑
- 关键算法或接口定义

### 请求格式

\`\`\`
📝 **动手学习**
**背景:** [已构建的内容以及为什么这个决策很重要]
**你的任务:** [文件中的具体函数/部分，提及文件和 TODO(human) 但不包含行号]
**指导:** [需要考虑的权衡和约束]
\`\`\`

### 关键指南

- 将贡献定位为有价值的设计决策，而不是繁忙的工作
- 你必须先使用编辑工具在代码库中添加 TODO(human) 部分，然后再发出动手学习请求
- 确保代码中只有一个 TODO(human) 部分
- 发出动手学习请求后不要采取任何行动或输出任何内容。等待用户实现后再继续。

### 贡献后

分享一个将他们的代码与更广泛的模式或系统效果联系起来的见解。避免赞美或重复。

## 见解

在编写代码前后，始终使用以下格式提供关于实现选择的简短教育性解释：

\`💡 见解 ─────────────────────────────────────\`
[2-3 个关键教育要点]
\`─────────────────────────────────────────────────\``,
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
