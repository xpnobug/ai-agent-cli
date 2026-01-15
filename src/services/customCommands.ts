/**
 * 自定义命令/技能加载器 - Production-grade
 * 
 * 支持功能：
 * - 多目录加载 (project/user)
 * - 仅使用 .ai-agent 目录结构
 * - 完整 frontmatter 解析
 * - 技能优先级管理
 * - 缓存和按需重载
 */

import fs from 'fs-extra';
import path from 'node:path';
import { homedir } from 'node:os';
import matter from 'gray-matter';
import type {
    Skill,
    SkillFrontmatter,
    SkillSource,
    SkillScope,
} from '../tools/types.js';

// ============================================================
// 工具函数
// ============================================================

/**
 * 将值转换为布尔值
 */
function toBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
        if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    }
    return false;
}

/**
 * 解析 allowed-tools 字段
 */
function parseAllowedTools(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value.map(v => String(v).trim()).filter(Boolean);
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return [];
        return trimmed.split(/\s+/).map(v => v.trim()).filter(Boolean);
    }
    return [];
}

/**
 * 解析 max-thinking-tokens 字段
 */
function parseMaxThinkingTokens(frontmatter: SkillFrontmatter): number | undefined {
    const raw =
        frontmatter.maxThinkingTokens ??
        frontmatter.max_thinking_tokens ??
        frontmatter['max-thinking-tokens'];

    if (raw === undefined || raw === null) return undefined;
    const value = typeof raw === 'number' ? raw : Number(String(raw).trim());
    if (!Number.isFinite(value) || value < 0) return undefined;
    return Math.floor(value);
}

/**
 * 获取来源标签
 */
function sourceLabel(source: SkillSource): string {
    if (source === 'localSettings') return 'project';
    if (source === 'userSettings') return 'user';
    if (source === 'pluginDir') return 'plugin';
    return 'unknown';
}

/**
 * 判断是否为 SKILL.md 文件
 */
function isSkillMarkdownFile(filePath: string): boolean {
    return /^skill\.md$/i.test(path.basename(filePath));
}

/**
 * 从 Markdown 内容提取描述
 */
function extractDescriptionFromMarkdown(markdown: string, fallback: string): string {
    const lines = markdown.split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const heading = trimmed.match(/^#{1,6}\s+(.*)$/);
        if (heading?.[1]) return heading[1].trim();
        return trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed;
    }
    return fallback;
}

// ============================================================
// 目录配置 (仅 .ai-agent)
// ============================================================

/**
 * 获取 Kode 用户目录
 */
function getKodeUserDir(): string {
    return path.join(homedir(), '.ai-agent');
}

/**
 * 获取所有自定义命令/技能目录
 */
export function getCustomCommandDirectories(cwd: string = process.cwd()): {
    projectCommands: string;
    projectSkills: string;
    userCommands: string;
    userSkills: string;
} {
    const userKodeDir = getKodeUserDir();
    return {
        // Project level (.ai-agent/)
        projectCommands: path.join(cwd, '.ai-agent', 'commands'),
        projectSkills: path.join(cwd, '.ai-agent', 'skills'),
        // User level (~/.ai-agent/)
        userCommands: path.join(userKodeDir, 'commands'),
        userSkills: path.join(userKodeDir, 'skills'),
    };
}

// ============================================================
// 文件扫描
// ============================================================

/**
 * 递归列出目录中的所有 Markdown 文件
 */
function listMarkdownFilesRecursively(
    baseDir: string,
    signal?: AbortSignal
): string[] {
    const results: string[] = [];
    const queue: string[] = [baseDir];

    while (queue.length > 0) {
        if (signal?.aborted) break;
        const currentDir = queue.pop()!;

        let entries;
        try {
            entries = fs.readdirSync(currentDir, { withFileTypes: true });
        } catch {
            continue;
        }

        for (const entry of entries) {
            if (signal?.aborted) break;
            const fullPath = path.join(currentDir, entry.name);

            if (entry.isDirectory()) {
                queue.push(fullPath);
                continue;
            }

            if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
                results.push(fullPath);
            }
        }
    }

    return results;
}

// ============================================================
// Frontmatter 解析
// ============================================================

/**
 * 解析 Markdown 文件的 frontmatter
 */
function parseFrontmatter(content: string): {
    frontmatter: SkillFrontmatter;
    content: string;
} {
    try {
        const { data, content: body } = matter(content);
        return {
            frontmatter: data as SkillFrontmatter,
            content: body.trim(),
        };
    } catch {
        return {
            frontmatter: {},
            content: content.trim(),
        };
    }
}

// ============================================================
// 技能创建
// ============================================================

interface SkillFileRecord {
    baseDir: string;
    filePath: string;
    frontmatter: SkillFrontmatter;
    content: string;
    source: SkillSource;
    scope: SkillScope;
}

/**
 * 从目录路径获取命名空间
 */
function namespaceFromDirPath(dirPath: string, baseDir: string): string {
    const relPath = path.relative(baseDir, dirPath);
    if (!relPath || relPath === '.' || relPath.startsWith('..')) return '';
    return relPath.split(path.sep).join(':');
}

/**
 * 从文件路径获取命令名称
 */
function nameForCommandFile(filePath: string, baseDir: string): string {
    if (isSkillMarkdownFile(filePath)) {
        const skillDir = path.dirname(filePath);
        const parentDir = path.dirname(skillDir);
        const skillName = path.basename(skillDir);
        const namespace = namespaceFromDirPath(parentDir, baseDir);
        return namespace ? `${namespace}:${skillName}` : skillName;
    }

    const dir = path.dirname(filePath);
    const namespace = namespaceFromDirPath(dir, baseDir);
    const fileName = path.basename(filePath).replace(/\.md$/i, '');
    return namespace ? `${namespace}:${fileName}` : fileName;
}

/**
 * 从文件记录创建技能对象
 */
function createSkillFromFile(record: SkillFileRecord): Skill | null {
    const isSkill = isSkillMarkdownFile(record.filePath);
    const name = nameForCommandFile(record.filePath, record.baseDir);
    if (!name) return null;

    const descriptionText =
        record.frontmatter.description ??
        extractDescriptionFromMarkdown(
            record.content,
            isSkill ? 'Skill' : 'Custom command'
        );

    const allowedTools = parseAllowedTools(record.frontmatter['allowed-tools']);
    const maxThinkingTokens = parseMaxThinkingTokens(record.frontmatter);
    const argumentHint = record.frontmatter['argument-hint'];
    const whenToUse = record.frontmatter.when_to_use;
    const version = record.frontmatter.version;
    const disableModelInvocation = toBoolean(
        record.frontmatter['disable-model-invocation']
    );
    const model =
        record.frontmatter.model === 'inherit'
            ? undefined
            : record.frontmatter.model;

    const description = `${descriptionText} (${sourceLabel(record.source)})`;
    const progressMessage = isSkill ? 'loading' : 'running';
    const skillBaseDir = isSkill ? path.dirname(record.filePath) : undefined;
    const bodyContent = record.content;

    return {
        type: 'prompt',
        name,
        description,
        body: bodyContent,
        path: record.filePath,
        dir: path.dirname(record.filePath),
        isEnabled: record.frontmatter.enabled !== false,
        isHidden: record.frontmatter.hidden === true,
        isSkill,
        aliases: record.frontmatter.aliases,
        allowedTools: allowedTools.length > 0 ? allowedTools : undefined,
        argumentHint,
        whenToUse,
        version,
        model,
        maxThinkingTokens,
        progressMessage,
        disableModelInvocation,
        hasUserSpecifiedDescription: !!record.frontmatter.description,
        source: record.source,
        scope: record.scope,

        userFacingName() {
            return name;
        },

        async getPromptForCommand(args: string): Promise<string> {
            let prompt = bodyContent;

            // 如果是技能，添加基础目录信息
            if (isSkill && skillBaseDir) {
                prompt = `Base directory for this skill: ${skillBaseDir}\n\n${prompt}`;
            }

            // 参数替换
            const trimmedArgs = args.trim();
            if (trimmedArgs) {
                if (prompt.includes('$ARGUMENTS')) {
                    prompt = prompt.replaceAll('$ARGUMENTS', trimmedArgs);
                } else {
                    prompt = `${prompt}\n\nARGUMENTS: ${trimmedArgs}`;
                }
            }

            return prompt;
        },
    };
}

// ============================================================
// 目录加载
// ============================================================

/**
 * 从命令目录加载 Markdown 文件记录
 */
function loadMarkdownFilesFromDir(
    baseDir: string,
    source: SkillSource,
    scope: SkillScope,
    signal?: AbortSignal
): SkillFileRecord[] {
    if (!fs.existsSync(baseDir)) return [];

    const files = listMarkdownFilesRecursively(baseDir, signal);
    const records: SkillFileRecord[] = [];

    for (const filePath of files) {
        if (signal?.aborted) break;
        try {
            const raw = fs.readFileSync(filePath, 'utf8');
            const { frontmatter, content } = parseFrontmatter(raw);
            records.push({ baseDir, filePath, frontmatter, content, source, scope });
        } catch {
            // 忽略无法读取的文件
        }
    }

    return records;
}

/**
 * 从技能目录加载技能（查找 SKILL.md）
 */
function loadSkillsFromSkillsDir(
    skillsDir: string,
    source: SkillSource,
    scope: SkillScope
): Skill[] {
    if (!fs.existsSync(skillsDir)) return [];

    const out: Skill[] = [];
    let entries;

    try {
        entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    } catch {
        return [];
    }

    for (const entry of entries) {
        if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;

        const skillDir = path.join(skillsDir, entry.name);
        const skillFileCandidates = [
            path.join(skillDir, 'SKILL.md'),
            path.join(skillDir, 'skill.md'),
        ];

        const skillFile = skillFileCandidates.find(p => fs.existsSync(p));
        if (!skillFile) continue;

        try {
            const raw = fs.readFileSync(skillFile, 'utf8');
            const { frontmatter, content } = parseFrontmatter(raw);

            const skill = createSkillFromFile({
                baseDir: skillsDir,
                filePath: skillFile,
                frontmatter,
                content,
                source,
                scope,
            });

            if (skill) {
                out.push(skill);
            }
        } catch {
            // 忽略无法解析的文件
        }
    }

    return out;
}

// ============================================================
// 主加载函数
// ============================================================

// 缓存
let cachedSkills: Skill[] | null = null;
let lastLoadTime = 0;
const CACHE_TTL = 60000; // 1分钟缓存

/**
 * 加载所有自定义命令和技能
 */
export async function loadCustomCommands(
    cwd: string = process.cwd()
): Promise<Skill[]> {
    // 检查缓存
    const now = Date.now();
    if (cachedSkills && (now - lastLoadTime) < CACHE_TTL) {
        return cachedSkills;
    }

    const dirs = getCustomCommandDirectories(cwd);
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 3000);

    try {
        // 1. 加载命令文件
        const commandFiles: SkillFileRecord[] = [
            // Project level (higher priority)
            ...loadMarkdownFilesFromDir(
                dirs.projectCommands,
                'localSettings',
                'project',
                abortController.signal
            ),
            // User level (lower priority)
            ...loadMarkdownFilesFromDir(
                dirs.userCommands,
                'userSettings',
                'user',
                abortController.signal
            ),
        ];

        // 2. 从命令文件创建技能
        const fileSkills = commandFiles
            .map(createSkillFromFile)
            .filter((skill): skill is Skill => skill !== null);

        // 3. 加载技能目录
        const skillDirSkills: Skill[] = [
            // Project level
            ...loadSkillsFromSkillsDir(dirs.projectSkills, 'localSettings', 'project'),
            // User level
            ...loadSkillsFromSkillsDir(dirs.userSkills, 'userSettings', 'user'),
        ];

        // 4. 合并并去重（按名称，先定义的优先）
        const allSkills = [...fileSkills, ...skillDirSkills].filter(s => s.isEnabled);
        const seen = new Set<string>();
        const unique: Skill[] = [];

        for (const skill of allSkills) {
            const key = skill.userFacingName();
            if (seen.has(key)) continue;
            seen.add(key);
            unique.push(skill);
        }

        // 更新缓存
        cachedSkills = unique;
        lastLoadTime = now;

        return unique;
    } catch (error) {
        console.error('加载自定义命令失败:', error);
        return cachedSkills || [];
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * 重新加载自定义命令（清除缓存）
 */
export function reloadCustomCommands(): void {
    cachedSkills = null;
    lastLoadTime = 0;
}

/**
 * 同步加载自定义命令（用于初始化）
 */
export function loadCustomCommandsSync(cwd: string = process.cwd()): Skill[] {
    // 强制清除缓存并同步加载
    reloadCustomCommands();

    const dirs = getCustomCommandDirectories(cwd);

    // 加载命令文件
    const commandFiles: SkillFileRecord[] = [
        ...loadMarkdownFilesFromDir(dirs.projectCommands, 'localSettings', 'project'),
        ...loadMarkdownFilesFromDir(dirs.userCommands, 'userSettings', 'user'),
    ];

    const fileSkills = commandFiles
        .map(createSkillFromFile)
        .filter((skill): skill is Skill => skill !== null);

    // 加载技能目录
    const skillDirSkills: Skill[] = [
        ...loadSkillsFromSkillsDir(dirs.projectSkills, 'localSettings', 'project'),
        ...loadSkillsFromSkillsDir(dirs.userSkills, 'userSettings', 'user'),
    ];

    // 合并去重
    const allSkills = [...fileSkills, ...skillDirSkills].filter(s => s.isEnabled);
    const seen = new Set<string>();
    const unique: Skill[] = [];

    for (const skill of allSkills) {
        const key = skill.userFacingName();
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(skill);
    }

    cachedSkills = unique;
    lastLoadTime = Date.now();

    return unique;
}

/**
 * 检查是否有自定义命令
 */
export function hasCustomCommands(cwd: string = process.cwd()): boolean {
    const dirs = getCustomCommandDirectories(cwd);
    return (
        fs.existsSync(dirs.projectCommands) ||
        fs.existsSync(dirs.projectSkills) ||
        fs.existsSync(dirs.userCommands) ||
        fs.existsSync(dirs.userSkills)
    );
}
