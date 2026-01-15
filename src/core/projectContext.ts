/**
 * 项目上下文管理
 * 提供项目级别的记忆系统，存储常用命令、代码风格偏好等
 */

import fs from 'fs-extra';
import path from 'node:path';
import { PROJECT_FILE } from './constants.js';

/**
 * 项目上下文接口
 */
export interface ProjectContext {
  /** 常用命令 */
  commands?: {
    build?: string;
    test?: string;
    lint?: string;
    typecheck?: string;
    dev?: string;
    [key: string]: string | undefined;
  };
  /** 代码风格偏好 */
  codeStyle?: {
    naming?: string;
    preferredLibraries?: string[];
    conventions?: string[];
  };
  /** 代码库信息 */
  codebaseInfo?: string;
  /** 自定义内容 */
  customContent?: string;
}

/**
 * 项目上下文管理器
 */
export class ProjectContextManager {
  private workdir: string;
  private projectFilePath: string;
  private context: ProjectContext | null = null;

  constructor(workdir: string) {
    this.workdir = workdir;
    this.projectFilePath = path.join(workdir, PROJECT_FILE);
  }

  /**
   * 加载项目上下文
   */
  load(): ProjectContext | null {
    if (!fs.existsSync(this.projectFilePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(this.projectFilePath, 'utf-8');
      this.context = this.parseProjectFile(content);
      return this.context;
    } catch {
      return null;
    }
  }

  /**
   * 解析项目文件内容
   */
  private parseProjectFile(content: string): ProjectContext {
    const context: ProjectContext = {};

    // 解析命令部分
    const commandsMatch = content.match(/## 常用命令\n([\s\S]*?)(?=\n## |$)/);
    if (commandsMatch) {
      context.commands = {};
      const lines = commandsMatch[1].trim().split('\n');
      for (const line of lines) {
        const match = line.match(/^- \*\*(\w+)\*\*:\s*`(.+)`/);
        if (match) {
          context.commands[match[1].toLowerCase()] = match[2];
        }
      }
    }

    // 解析代码风格部分
    const styleMatch = content.match(/## 代码风格\n([\s\S]*?)(?=\n## |$)/);
    if (styleMatch) {
      context.codeStyle = {
        conventions: styleMatch[1].trim().split('\n').filter(l => l.startsWith('- ')).map(l => l.slice(2)),
      };
    }

    // 解析代码库信息部分
    const infoMatch = content.match(/## 代码库信息\n([\s\S]*?)(?=\n## |$)/);
    if (infoMatch) {
      context.codebaseInfo = infoMatch[1].trim();
    }

    // 保存原始内容
    context.customContent = content;

    return context;
  }

  /**
   * 生成项目上下文的提示词
   */
  getContextPrompt(): string | null {
    const context = this.context || this.load();
    if (!context) {
      return null;
    }

    const sections: string[] = ['# 项目上下文\n'];

    // 添加命令信息
    if (context.commands && Object.keys(context.commands).length > 0) {
      sections.push('## 常用命令\n');
      for (const [name, cmd] of Object.entries(context.commands)) {
        if (cmd) {
          sections.push(`- **${name}**: \`${cmd}\``);
        }
      }
      sections.push('');
    }

    // 添加代码风格信息
    if (context.codeStyle?.conventions?.length) {
      sections.push('## 代码风格\n');
      for (const convention of context.codeStyle.conventions) {
        sections.push(`- ${convention}`);
      }
      sections.push('');
    }

    // 添加代码库信息
    if (context.codebaseInfo) {
      sections.push('## 代码库信息\n');
      sections.push(context.codebaseInfo);
      sections.push('');
    }

    return sections.join('\n');
  }

  /**
   * 检查项目文件是否存在
   */
  exists(): boolean {
    return fs.existsSync(this.projectFilePath);
  }

  /**
   * 创建初始项目文件
   */
  createInitialFile(): void {
    const initialContent = `# ${path.basename(this.workdir)} 项目配置

## 常用命令

- **build**: \`npm run build\`
- **test**: \`npm test\`
- **lint**: \`npm run lint\`
- **dev**: \`npm run dev\`

## 代码风格

- 使用 TypeScript
- 使用 ESLint 进行代码检查
- 使用 Prettier 进行代码格式化

## 代码库信息

(在这里添加关于代码库结构和组织的有用信息)
`;

    fs.ensureDirSync(path.dirname(this.projectFilePath));
    fs.writeFileSync(this.projectFilePath, initialContent, 'utf-8');
  }

  /**
   * 添加命令到项目文件
   */
  addCommand(name: string, command: string): void {
    if (!this.exists()) {
      this.createInitialFile();
    }

    let content = fs.readFileSync(this.projectFilePath, 'utf-8');
    
    // 检查命令是否已存在
    const commandRegex = new RegExp(`^- \\*\\*${name}\\*\\*:.*$`, 'm');
    if (commandRegex.test(content)) {
      // 更新现有命令
      content = content.replace(commandRegex, `- **${name}**: \`${command}\``);
    } else {
      // 添加新命令
      const insertPoint = content.indexOf('## 代码风格');
      if (insertPoint > 0) {
        content = content.slice(0, insertPoint) + `- **${name}**: \`${command}\`\n\n` + content.slice(insertPoint);
      }
    }

    fs.writeFileSync(this.projectFilePath, content, 'utf-8');
    this.context = null; // 清除缓存
  }

  /**
   * 获取特定命令
   */
  getCommand(name: string): string | undefined {
    const context = this.context || this.load();
    return context?.commands?.[name.toLowerCase()];
  }
}

/**
 * 全局实例
 */
let projectContextInstance: ProjectContextManager | null = null;

export function getProjectContextManager(workdir?: string): ProjectContextManager {
  if (!projectContextInstance && workdir) {
    projectContextInstance = new ProjectContextManager(workdir);
  }
  if (!projectContextInstance) {
    throw new Error('ProjectContextManager 未初始化');
  }
  return projectContextInstance;
}

export function resetProjectContextManager(): void {
  projectContextInstance = null;
}
