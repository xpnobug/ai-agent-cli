/**
 * 技能加载工具 - Production-grade
 * 支持多目录加载、完整 frontmatter、AI 自动调用
 */

import fs from 'fs-extra';
import path from 'node:path';
import type { Skill, SkillResult } from '../types.js';
import {
  loadCustomCommands,
  loadCustomCommandsSync,
  reloadCustomCommands,
  getCustomCommandDirectories,
} from '../../services/customCommands.js';

// ============================================================
// 技能格式化
// ============================================================

/**
 * 格式化技能信息块（用于 AI 提示词）
 */
function formatSkillBlock(skill: Skill): string {
  const name = skill.userFacingName();
  const description = skill.whenToUse
    ? `${skill.description} - ${skill.whenToUse}`
    : skill.description;

  return `<skill>
<name>
${name}
</name>
<description>
${description}
</description>
<location>
${skill.path || ''}
</location>
</skill>`;
}

// ============================================================
// SkillLoader 类
// ============================================================

/**
 * 技能加载器配置
 */
export interface SkillLoaderConfig {
  skillsDir?: string;     // 向后兼容：单一技能目录
  cwd?: string;           // 工作目录（用于多目录加载）
}

/**
 * 技能加载器 (Production-grade)
 */
export class SkillLoader {
  private skills: Map<string, Skill> = new Map();
  private config: SkillLoaderConfig;

  constructor(configOrSkillsDir: string | SkillLoaderConfig) {
    // 向后兼容：支持单一字符串参数
    if (typeof configOrSkillsDir === 'string') {
      this.config = { skillsDir: configOrSkillsDir };
    } else {
      this.config = configOrSkillsDir;
    }

    this.loadSkillsSync();
  }

  /**
   * 同步加载技能
   */
  private loadSkillsSync(): void {
    const cwd = this.config.cwd || process.cwd();
    const skills = loadCustomCommandsSync(cwd);

    this.skills.clear();
    for (const skill of skills) {
      this.skills.set(skill.name, skill);
    }

    console.log(`已加载 ${this.skills.size} 个技能`);
  }

  /**
   * 异步重新加载技能
   */
  async reload(): Promise<void> {
    reloadCustomCommands();
    const cwd = this.config.cwd || process.cwd();
    const skills = await loadCustomCommands(cwd);

    this.skills.clear();
    for (const skill of skills) {
      this.skills.set(skill.name, skill);
    }

    console.log(`已重新加载 ${this.skills.size} 个技能`);
  }

  /**
   * 获取技能
   */
  getSkill(name: string): Skill | undefined {
    // 直接匹配
    const direct = this.skills.get(name);
    if (direct) return direct;

    // 尝试别名匹配
    for (const skill of this.skills.values()) {
      if (skill.aliases?.includes(name)) {
        return skill;
      }
    }

    // 尝试不带斜杠匹配
    const withoutSlash = name.startsWith('/') ? name.slice(1) : name;
    return this.skills.get(withoutSlash);
  }

  /**
   * 获取所有技能的描述（用于系统提示词 - Layer 1）
   */
  getDescriptions(): string {
    if (this.skills.size === 0) {
      return '(无可用技能)';
    }

    return Array.from(this.skills.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, skill]) => {
        const whenToUse = skill.whenToUse ? ` | 使用场景: ${skill.whenToUse}` : '';
        return `- ${name}: ${skill.description}${whenToUse}`;
      })
      .join('\n');
  }

  /**
   * 生成 AI 工具提示词（对标 Kode-cli SkillTool.prompt）
   */
  async getToolPrompt(): Promise<string> {
    const skills = Array.from(this.skills.values()).filter(
      skill =>
        skill.type === 'prompt' &&
        !skill.disableModelInvocation &&
        (skill.hasUserSpecifiedDescription || skill.whenToUse)
    );

    // Token 预算限制
    const budget = Number(process.env.SKILL_TOOL_CHAR_BUDGET) || 15000;
    const limited: Skill[] = [];
    let used = 0;

    for (const skill of skills) {
      const block = formatSkillBlock(skill);
      used += block.length + 1;
      if (used > budget) break;
      limited.push(skill);
    }

    const availableSkills = limited.map(formatSkillBlock).join('\n');
    const truncatedNotice =
      skills.length > limited.length
        ? `\n<!-- Showing ${limited.length} of ${skills.length} skills due to token limits -->`
        : '';

    return `Execute a skill within the main conversation

<skills_instructions>
When users ask you to perform tasks, check if any of the available skills below can help complete the task more effectively. Skills provide specialized capabilities and domain knowledge.

When users ask you to run a "slash command" or reference "/<something>" (e.g., "/commit", "/review-pr"), they are referring to a skill. Use this tool to invoke the corresponding skill.

<example>
User: "run /commit"
Assistant: [Calls Skill tool with skill: "commit"]
</example>

How to invoke:
- Use this tool with the skill name and optional arguments
- Examples:
  - \`skill: "pdf"\` - invoke the pdf skill
  - \`skill: "commit", args: "-m 'Fix bug'"\` - invoke with arguments
  - \`skill: "review-pr", args: "123"\` - invoke with arguments

Important:
- When a skill is relevant, you must invoke this tool IMMEDIATELY as your first action
- NEVER just announce or mention a skill in your text response without actually calling this tool
- This is a BLOCKING REQUIREMENT: invoke the relevant Skill tool BEFORE generating any other response about the task
- Only use skills listed in <available_skills> below
- Do not invoke a skill that is already running
- Do not use this tool for built-in CLI commands (like /help, /clear, etc.)
</skills_instructions>

<available_skills>
${availableSkills}${truncatedNotice}
</available_skills>
`;
  }

  /**
   * 获取技能的完整内容（Layer 2 + Layer 3）
   */
  getSkillContent(name: string): string | null {
    const skill = this.getSkill(name);
    if (!skill) {
      return null;
    }

    // Layer 2: 技能主体内容
    let content = `# 技能: ${skill.name}\n\n${skill.body}`;

    // Layer 3: 列出可用资源
    const resources: string[] = [];
    const folders = [
      ['scripts', '脚本'],
      ['references', '参考资料'],
      ['assets', '资源文件'],
    ];

    for (const [folder, label] of folders) {
      const folderPath = path.join(skill.dir, folder);
      if (fs.existsSync(folderPath)) {
        const files = fs.readdirSync(folderPath);
        if (files.length > 0) {
          resources.push(`${label}: ${files.join(', ')}`);
        }
      }
    }

    if (resources.length > 0) {
      content += `\n\n**可用资源（位于 ${skill.dir}）：**\n`;
      content += resources.map((r) => `- ${r}`).join('\n');
    }

    return content;
  }

  /**
   * 列出所有技能名称
   */
  listSkills(): string[] {
    return Array.from(this.skills.keys()).sort();
  }

  /**
   * 获取技能数量
   */
  getCount(): number {
    return this.skills.size;
  }

  /**
   * 获取所有加载的技能
   */
  getAllSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  /**
   * 获取技能目录信息
   */
  getDirectories(): ReturnType<typeof getCustomCommandDirectories> {
    return getCustomCommandDirectories(this.config.cwd);
  }
}

// ============================================================
// 全局实例管理
// ============================================================

let skillLoaderInstance: SkillLoader | null = null;

/**
 * 获取 SkillLoader 实例
 */
export function getSkillLoader(configOrSkillsDir: string | SkillLoaderConfig): SkillLoader {
  if (!skillLoaderInstance) {
    skillLoaderInstance = new SkillLoader(configOrSkillsDir);
  }
  return skillLoaderInstance;
}

/**
 * 重置 SkillLoader 实例
 */
export function resetSkillLoader(): void {
  skillLoaderInstance = null;
  reloadCustomCommands();
}

// ============================================================
// 技能执行函数
// ============================================================

/**
 * 规范化模型名称
 */
function normalizeModelName(model: unknown): string | undefined {
  if (typeof model !== 'string') return undefined;
  const trimmed = model.trim();
  if (!trimmed || trimmed === 'inherit') return undefined;
  if (trimmed === 'haiku') return 'quick';
  if (trimmed === 'sonnet') return 'task';
  if (trimmed === 'opus') return 'main';
  return trimmed;
}

/**
 * 执行 Skill 工具 (Production-grade)
 */
export async function runSkill(
  skillLoader: SkillLoader,
  skillName: string,
  args?: string
): Promise<SkillResult> {
  const raw = skillName.trim();
  const name = raw.startsWith('/') ? raw.slice(1) : raw;

  const skill = skillLoader.getSkill(name);

  if (!skill) {
    const available = skillLoader.listSkills().join(', ') || '无';
    return {
      success: false,
      commandName: name,
      error: `未知技能 "${name}"。可用技能: ${available}`,
    };
  }

  // 检查是否禁止 AI 调用
  if (skill.disableModelInvocation) {
    return {
      success: false,
      commandName: name,
      error: `技能 ${name} 已禁用 AI 调用 (disable-model-invocation)`,
    };
  }

  try {
    // 获取带参数替换的 prompt
    const prompt = await skill.getPromptForCommand(args || '');

    return {
      success: true,
      commandName: skill.userFacingName(),
      prompt,
      allowedTools: skill.allowedTools,
      model: normalizeModelName(skill.model),
      maxThinkingTokens: skill.maxThinkingTokens,
    };
  } catch (error) {
    return {
      success: false,
      commandName: name,
      error: `技能执行失败: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * 执行 Skill 工具（向后兼容 - 返回字符串）
 */
export async function runSkillLegacy(
  skillLoader: SkillLoader,
  skillName: string
): Promise<string> {
  const result = await runSkill(skillLoader, skillName);

  if (!result.success) {
    return `错误: ${result.error}`;
  }

  // 返回格式化的技能内容
  return `<skill-loaded name="${result.commandName}">
${result.prompt}
</skill-loaded>

请按照上述技能中的指导完成用户的任务。`;
}
