/**
 * 技能市场 - Skill Marketplace
 * 
 * 支持功能：
 * - 本地目录安装
 * - GitHub 仓库安装 (通过 ZIP 下载)
 * - 插件启用/禁用
 * - 插件卸载
 */

import fs from 'fs-extra';
import path from 'node:path';
import { homedir } from 'node:os';
import { execSync } from 'node:child_process';
import type { SkillScope, InstalledSkillPlugin } from '../tools/types.js';

// ============================================================
// 目录配置
// ============================================================

/**
 * 获取 Kode 用户目录
 */
function getKodeUserDir(): string {
    return path.join(homedir(), '.ai-agent');
}

/**
 * 获取插件目录
 */
function getPluginsDir(scope: SkillScope = 'user', cwd: string = process.cwd()): string {
    if (scope === 'project') {
        return path.join(cwd, '.ai-agent', 'plugins');
    }
    return path.join(getKodeUserDir(), 'plugins');
}

/**
 * 获取技能目录
 */
function getSkillsDir(scope: SkillScope = 'user', cwd: string = process.cwd()): string {
    if (scope === 'project') {
        return path.join(cwd, '.ai-agent', 'skills');
    }
    return path.join(getKodeUserDir(), 'skills');
}

/**
 * 获取命令目录
 */
function getCommandsDir(scope: SkillScope = 'user', cwd: string = process.cwd()): string {
    if (scope === 'project') {
        return path.join(cwd, '.ai-agent', 'commands');
    }
    return path.join(getKodeUserDir(), 'commands');
}

/**
 * 获取已安装插件配置文件路径
 */
function getInstalledPluginsPath(): string {
    return path.join(getKodeUserDir(), 'installed-plugins.json');
}

// ============================================================
// 工具函数
// ============================================================

/**
 * 确保目录存在
 */
function ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

/**
 * 读取 JSON 文件
 */
function readJsonFile<T>(filePath: string, fallback: T): T {
    try {
        if (!fs.existsSync(filePath)) return fallback;
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content) as T;
    } catch {
        return fallback;
    }
}

/**
 * 写入 JSON 文件
 */
function writeJsonFile(filePath: string, data: unknown): void {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

/**
 * 复制目录
 */
function copyDirectory(src: string, dest: string): void {
    ensureDir(dest);
    fs.copySync(src, dest);
}

/**
 * 解析 GitHub 仓库 URL
 */
function parseGitHubUrl(input: string): { owner: string; repo: string; ref?: string; path?: string } | null {
    // 支持格式:
    // - github:owner/repo
    // - github:owner/repo@ref
    // - github:owner/repo/path
    // - https://github.com/owner/repo

    let url = input.trim();

    // github: 前缀
    if (url.startsWith('github:')) {
        url = url.slice(7);
    }

    // https://github.com/ 前缀
    if (url.startsWith('https://github.com/')) {
        url = url.slice(19);
    }

    // 解析 owner/repo[@ref][/path]
    const parts = url.split('/');
    if (parts.length < 2) return null;

    const owner = parts[0];
    let repo = parts[1];
    let ref: string | undefined;
    let subPath: string | undefined;

    // 检查 @ref
    if (repo.includes('@')) {
        const [repoName, refName] = repo.split('@');
        repo = repoName;
        ref = refName;
    }

    // 检查子路径
    if (parts.length > 2) {
        subPath = parts.slice(2).join('/');
    }

    return { owner, repo, ref, path: subPath };
}

/**
 * 从 GitHub 下载并解压
 */
async function downloadFromGitHub(
    owner: string,
    repo: string,
    ref: string = 'main',
    destDir: string
): Promise<void> {
    const zipUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${ref}.zip`;
    const tempZip = path.join(destDir, '..', `${repo}-${Date.now()}.zip`);
    const tempDir = path.join(destDir, '..', `${repo}-temp-${Date.now()}`);

    try {
        // 使用 curl 下载
        console.log(`下载: ${zipUrl}`);
        execSync(`curl -L -o "${tempZip}" "${zipUrl}"`, { stdio: 'pipe' });

        // 解压
        ensureDir(tempDir);
        execSync(`unzip -q "${tempZip}" -d "${tempDir}"`, { stdio: 'pipe' });

        // 找到解压后的目录（通常是 repo-branch）
        const extractedDirs = fs.readdirSync(tempDir);
        if (extractedDirs.length === 0) {
            throw new Error('解压后目录为空');
        }

        const srcDir = path.join(tempDir, extractedDirs[0]);

        // 复制到目标目录
        copyDirectory(srcDir, destDir);

        console.log(`已下载到: ${destDir}`);
    } finally {
        // 清理临时文件
        if (fs.existsSync(tempZip)) fs.unlinkSync(tempZip);
        if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true });
    }
}

// ============================================================
// 已安装插件管理
// ============================================================

interface InstalledPluginsFile {
    plugins: InstalledSkillPlugin[];
}

/**
 * 加载已安装插件列表
 */
export function loadInstalledPlugins(): InstalledSkillPlugin[] {
    const data = readJsonFile<InstalledPluginsFile>(getInstalledPluginsPath(), { plugins: [] });
    return data.plugins;
}

/**
 * 保存已安装插件列表
 */
function saveInstalledPlugins(plugins: InstalledSkillPlugin[]): void {
    writeJsonFile(getInstalledPluginsPath(), { plugins });
}

/**
 * 查找已安装插件
 */
function findInstalledPlugin(pluginName: string): InstalledSkillPlugin | undefined {
    const plugins = loadInstalledPlugins();
    return plugins.find(p => p.plugin === pluginName);
}

// ============================================================
// 插件安装
// ============================================================

export interface InstallOptions {
    scope?: SkillScope;
    force?: boolean;
    cwd?: string;
}

export interface InstallResult {
    success: boolean;
    pluginName: string;
    installedSkills: string[];
    installedCommands: string[];
    error?: string;
}

/**
 * 从本地目录安装技能包
 */
export async function installFromLocal(
    sourcePath: string,
    options: InstallOptions = {}
): Promise<InstallResult> {
    const { scope = 'user', force = false, cwd = process.cwd() } = options;

    const resolvedPath = path.resolve(cwd, sourcePath);

    if (!fs.existsSync(resolvedPath)) {
        return {
            success: false,
            pluginName: path.basename(sourcePath),
            installedSkills: [],
            installedCommands: [],
            error: `源路径不存在: ${resolvedPath}`,
        };
    }

    const pluginName = path.basename(resolvedPath);

    // 检查是否已安装
    const existing = findInstalledPlugin(pluginName);
    if (existing && !force) {
        return {
            success: false,
            pluginName,
            installedSkills: [],
            installedCommands: [],
            error: `插件 ${pluginName} 已安装。使用 --force 覆盖安装。`,
        };
    }

    const skillsDir = getSkillsDir(scope, cwd);
    const commandsDir = getCommandsDir(scope, cwd);
    const pluginsDir = getPluginsDir(scope, cwd);

    ensureDir(skillsDir);
    ensureDir(commandsDir);
    ensureDir(pluginsDir);

    const installedSkills: string[] = [];
    const installedCommands: string[] = [];

    try {
        const stat = fs.statSync(resolvedPath);

        if (stat.isDirectory()) {
            // 检查是否为技能目录（包含 SKILL.md）
            const skillMdPath = path.join(resolvedPath, 'SKILL.md');
            const skillMdLower = path.join(resolvedPath, 'skill.md');

            if (fs.existsSync(skillMdPath) || fs.existsSync(skillMdLower)) {
                // 单个技能目录
                const destPath = path.join(skillsDir, pluginName);
                if (fs.existsSync(destPath)) {
                    fs.rmSync(destPath, { recursive: true });
                }
                copyDirectory(resolvedPath, destPath);
                installedSkills.push(pluginName);
            } else {
                // 技能包目录（包含多个技能）
                const entries = fs.readdirSync(resolvedPath, { withFileTypes: true });

                for (const entry of entries) {
                    if (!entry.isDirectory()) continue;

                    const subDir = path.join(resolvedPath, entry.name);
                    const subSkillMd = path.join(subDir, 'SKILL.md');
                    const subSkillMdLower = path.join(subDir, 'skill.md');

                    if (fs.existsSync(subSkillMd) || fs.existsSync(subSkillMdLower)) {
                        const destPath = path.join(skillsDir, entry.name);
                        if (fs.existsSync(destPath)) {
                            fs.rmSync(destPath, { recursive: true });
                        }
                        copyDirectory(subDir, destPath);
                        installedSkills.push(entry.name);
                    }
                }

                // 检查是否有 commands 目录
                const commandsSrcDir = path.join(resolvedPath, 'commands');
                if (fs.existsSync(commandsSrcDir)) {
                    const cmdEntries = fs.readdirSync(commandsSrcDir);
                    for (const cmdFile of cmdEntries) {
                        if (!cmdFile.endsWith('.md')) continue;
                        const srcFile = path.join(commandsSrcDir, cmdFile);
                        const destFile = path.join(commandsDir, cmdFile);
                        fs.copyFileSync(srcFile, destFile);
                        installedCommands.push(cmdFile.replace('.md', ''));
                    }
                }
            }
        } else if (stat.isFile() && resolvedPath.endsWith('.md')) {
            // 单个命令文件
            const destFile = path.join(commandsDir, path.basename(resolvedPath));
            fs.copyFileSync(resolvedPath, destFile);
            installedCommands.push(path.basename(resolvedPath, '.md'));
        }

        // 保存安装记录
        const plugins = loadInstalledPlugins().filter(p => p.plugin !== pluginName);
        plugins.push({
            plugin: pluginName,
            marketplace: 'local',
            scope,
            kind: installedSkills.length > 1 ? 'skill-pack' : 'skill-pack',
            isEnabled: true,
            installedAt: new Date().toISOString(),
            pluginRoot: pluginsDir,
            skills: installedSkills,
            commands: installedCommands,
            sourceMarketplacePath: resolvedPath,
        });
        saveInstalledPlugins(plugins);

        return {
            success: true,
            pluginName,
            installedSkills,
            installedCommands,
        };
    } catch (error) {
        return {
            success: false,
            pluginName,
            installedSkills: [],
            installedCommands: [],
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * 从 GitHub 安装技能包
 */
export async function installFromGitHub(
    repoUrl: string,
    options: InstallOptions = {}
): Promise<InstallResult> {
    const { scope = 'user', force = false, cwd = process.cwd() } = options;

    const parsed = parseGitHubUrl(repoUrl);
    if (!parsed) {
        return {
            success: false,
            pluginName: repoUrl,
            installedSkills: [],
            installedCommands: [],
            error: `无效的 GitHub URL: ${repoUrl}`,
        };
    }

    const { owner, repo, ref = 'main', path: subPath } = parsed;
    const pluginName = subPath ? path.basename(subPath) : repo;

    // 检查是否已安装
    const existing = findInstalledPlugin(pluginName);
    if (existing && !force) {
        return {
            success: false,
            pluginName,
            installedSkills: [],
            installedCommands: [],
            error: `插件 ${pluginName} 已安装。使用 --force 覆盖安装。`,
        };
    }

    const tempDir = path.join(getKodeUserDir(), 'temp', `${repo}-${Date.now()}`);

    try {
        // 下载仓库
        await downloadFromGitHub(owner, repo, ref, tempDir);

        // 确定源目录
        const sourcePath = subPath ? path.join(tempDir, subPath) : tempDir;

        // 使用本地安装
        const result = await installFromLocal(sourcePath, { scope, force, cwd });

        // 更新来源信息
        if (result.success) {
            const plugins = loadInstalledPlugins();
            const plugin = plugins.find(p => p.plugin === pluginName);
            if (plugin) {
                plugin.marketplace = `github:${owner}/${repo}`;
                plugin.sourceMarketplacePath = repoUrl;
                saveInstalledPlugins(plugins);
            }
        }

        return result;
    } catch (error) {
        return {
            success: false,
            pluginName,
            installedSkills: [],
            installedCommands: [],
            error: error instanceof Error ? error.message : String(error),
        };
    } finally {
        // 清理临时目录
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true });
        }
    }
}

/**
 * 安装技能包（自动检测来源）
 */
export async function installSkillPlugin(
    source: string,
    options: InstallOptions = {}
): Promise<InstallResult> {
    // 检测来源类型
    if (source.startsWith('github:') || source.startsWith('https://github.com/')) {
        return installFromGitHub(source, options);
    }

    // 默认为本地路径
    return installFromLocal(source, options);
}

// ============================================================
// 插件卸载
// ============================================================

export interface UninstallResult {
    success: boolean;
    pluginName: string;
    removedSkills: string[];
    removedCommands: string[];
    error?: string;
}

/**
 * 卸载技能包
 */
export async function uninstallSkillPlugin(
    pluginName: string,
    options: { scope?: SkillScope; cwd?: string } = {}
): Promise<UninstallResult> {
    const { scope = 'user', cwd = process.cwd() } = options;

    const plugin = findInstalledPlugin(pluginName);
    if (!plugin) {
        return {
            success: false,
            pluginName,
            removedSkills: [],
            removedCommands: [],
            error: `插件 ${pluginName} 未安装`,
        };
    }

    const skillsDir = getSkillsDir(scope, cwd);
    const commandsDir = getCommandsDir(scope, cwd);

    const removedSkills: string[] = [];
    const removedCommands: string[] = [];

    try {
        // 删除技能
        for (const skillName of plugin.skills) {
            const skillPath = path.join(skillsDir, skillName);
            if (fs.existsSync(skillPath)) {
                fs.rmSync(skillPath, { recursive: true });
                removedSkills.push(skillName);
            }
        }

        // 删除命令
        for (const cmdName of plugin.commands) {
            const cmdPath = path.join(commandsDir, `${cmdName}.md`);
            if (fs.existsSync(cmdPath)) {
                fs.unlinkSync(cmdPath);
                removedCommands.push(cmdName);
            }
        }

        // 更新安装记录
        const plugins = loadInstalledPlugins().filter(p => p.plugin !== pluginName);
        saveInstalledPlugins(plugins);

        return {
            success: true,
            pluginName,
            removedSkills,
            removedCommands,
        };
    } catch (error) {
        return {
            success: false,
            pluginName,
            removedSkills: [],
            removedCommands: [],
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

// ============================================================
// 插件启用/禁用
// ============================================================

export interface EnableDisableResult {
    success: boolean;
    pluginName: string;
    error?: string;
}

/**
 * 启用插件
 */
export function enableSkillPlugin(pluginName: string): EnableDisableResult {
    const plugins = loadInstalledPlugins();
    const plugin = plugins.find(p => p.plugin === pluginName);

    if (!plugin) {
        return {
            success: false,
            pluginName,
            error: `插件 ${pluginName} 未安装`,
        };
    }

    plugin.isEnabled = true;
    saveInstalledPlugins(plugins);

    return { success: true, pluginName };
}

/**
 * 禁用插件
 */
export function disableSkillPlugin(pluginName: string): EnableDisableResult {
    const plugins = loadInstalledPlugins();
    const plugin = plugins.find(p => p.plugin === pluginName);

    if (!plugin) {
        return {
            success: false,
            pluginName,
            error: `插件 ${pluginName} 未安装`,
        };
    }

    plugin.isEnabled = false;
    saveInstalledPlugins(plugins);

    return { success: true, pluginName };
}

// ============================================================
// 列表查询
// ============================================================

/**
 * 列出已安装的插件
 */
export function listInstalledPlugins(): InstalledSkillPlugin[] {
    return loadInstalledPlugins();
}

/**
 * 获取插件详情
 */
export function getPluginDetails(pluginName: string): InstalledSkillPlugin | undefined {
    return findInstalledPlugin(pluginName);
}
