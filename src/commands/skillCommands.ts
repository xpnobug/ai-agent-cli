/**
 * 技能管理 CLI 命令
 * 
 * 支持命令:
 * - /skill list       - 列出所有可用技能
 * - /skill info       - 显示技能详情
 * - /skill install    - 安装技能包
 * - /skill uninstall  - 卸载技能包
 * - /skill enable     - 启用技能
 * - /skill disable    - 禁用技能
 * - /skill refresh    - 刷新技能列表
 */

import chalk from 'chalk';
import {
    installSkillPlugin,
    uninstallSkillPlugin,
    enableSkillPlugin,
    disableSkillPlugin,
    listInstalledPlugins,
} from '../services/skillMarketplace.js';
import {
    loadCustomCommands,
    reloadCustomCommands,
} from '../services/customCommands.js';
import type { SkillScope } from '../tools/types.js';

// ============================================================
// 命令处理
// ============================================================

interface SkillCommandResult {
    success: boolean;
    message: string;
}

/**
 * 解析命令参数
 */
function parseArgs(argsStr: string): { command: string; args: string[]; flags: Record<string, boolean> } {
    const parts = argsStr.trim().split(/\s+/).filter(Boolean);
    const command = parts[0] || '';
    const args: string[] = [];
    const flags: Record<string, boolean> = {};

    for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        if (part.startsWith('--')) {
            flags[part.slice(2)] = true;
        } else if (part.startsWith('-')) {
            flags[part.slice(1)] = true;
        } else {
            args.push(part);
        }
    }

    return { command, args, flags };
}

/**
 * 列出所有技能
 */
async function handleList(): Promise<SkillCommandResult> {
    const skills = await loadCustomCommands();

    if (skills.length === 0) {
        return {
            success: true,
            message: '暂无可用技能。\n\n使用 /skill install <path> 安装技能包。',
        };
    }

    const lines = [
        chalk.bold('可用技能:'),
        '',
    ];

    // 按来源分组
    const projectSkills = skills.filter(s => s.scope === 'project');
    const userSkills = skills.filter(s => s.scope === 'user');

    if (projectSkills.length > 0) {
        lines.push(chalk.cyan('项目级 (.ai-agent/skills):'));
        for (const skill of projectSkills) {
            const name = skill.userFacingName();
            const desc = skill.description.replace(/ \(project\)$/, '');
            lines.push(`  ${chalk.green(name)} - ${desc}`);
        }
        lines.push('');
    }

    if (userSkills.length > 0) {
        lines.push(chalk.cyan('用户级 (~/.ai-agent/skills):'));
        for (const skill of userSkills) {
            const name = skill.userFacingName();
            const desc = skill.description.replace(/ \(user\)$/, '');
            lines.push(`  ${chalk.green(name)} - ${desc}`);
        }
    }

    return { success: true, message: lines.join('\n') };
}

/**
 * 显示技能详情
 */
async function handleInfo(skillName: string): Promise<SkillCommandResult> {
    if (!skillName) {
        return { success: false, message: '用法: /skill info <skill-name>' };
    }

    const skills = await loadCustomCommands();
    const skill = skills.find(s => s.userFacingName() === skillName || s.name === skillName);

    if (!skill) {
        return { success: false, message: `技能 "${skillName}" 不存在` };
    }

    const lines = [
        chalk.bold(`技能: ${skill.userFacingName()}`),
        '',
        `${chalk.gray('描述:')} ${skill.description}`,
        `${chalk.gray('路径:')} ${skill.path}`,
        `${chalk.gray('来源:')} ${skill.scope === 'project' ? '项目' : '用户'}`,
    ];

    if (skill.whenToUse) {
        lines.push(`${chalk.gray('使用场景:')} ${skill.whenToUse}`);
    }

    if (skill.allowedTools?.length) {
        lines.push(`${chalk.gray('允许工具:')} ${skill.allowedTools.join(', ')}`);
    }

    if (skill.model) {
        lines.push(`${chalk.gray('模型:')} ${skill.model}`);
    }

    if (skill.version) {
        lines.push(`${chalk.gray('版本:')} ${skill.version}`);
    }

    return { success: true, message: lines.join('\n') };
}

/**
 * 安装技能包
 */
async function handleInstall(
    source: string,
    flags: Record<string, boolean>
): Promise<SkillCommandResult> {
    if (!source) {
        return {
            success: false,
            message: `用法: /skill install <path|github:owner/repo> [--project] [--force]

示例:
  /skill install ./my-skill        # 安装本地技能
  /skill install github:user/repo  # 从 GitHub 安装
  /skill install ./skill --project # 安装到项目级`,
        };
    }

    const scope: SkillScope = flags.project ? 'project' : 'user';
    const force = flags.force || flags.f;

    console.log(chalk.gray(`正在安装 ${source}...`));

    const result = await installSkillPlugin(source, { scope, force });

    if (!result.success) {
        return { success: false, message: chalk.red(`安装失败: ${result.error}`) };
    }

    const lines = [
        chalk.green(`✓ 安装成功: ${result.pluginName}`),
    ];

    if (result.installedSkills.length > 0) {
        lines.push(`  技能: ${result.installedSkills.join(', ')}`);
    }

    if (result.installedCommands.length > 0) {
        lines.push(`  命令: ${result.installedCommands.join(', ')}`);
    }

    // 刷新缓存
    reloadCustomCommands();

    return { success: true, message: lines.join('\n') };
}

/**
 * 卸载技能包
 */
async function handleUninstall(pluginName: string): Promise<SkillCommandResult> {
    if (!pluginName) {
        return { success: false, message: '用法: /skill uninstall <plugin-name>' };
    }

    const result = await uninstallSkillPlugin(pluginName);

    if (!result.success) {
        return { success: false, message: chalk.red(`卸载失败: ${result.error}`) };
    }

    reloadCustomCommands();

    return {
        success: true,
        message: chalk.green(`✓ 已卸载: ${result.pluginName}`),
    };
}

/**
 * 启用技能
 */
function handleEnable(pluginName: string): SkillCommandResult {
    if (!pluginName) {
        return { success: false, message: '用法: /skill enable <plugin-name>' };
    }

    const result = enableSkillPlugin(pluginName);

    if (!result.success) {
        return { success: false, message: chalk.red(`启用失败: ${result.error}`) };
    }

    reloadCustomCommands();

    return { success: true, message: chalk.green(`✓ 已启用: ${pluginName}`) };
}

/**
 * 禁用技能
 */
function handleDisable(pluginName: string): SkillCommandResult {
    if (!pluginName) {
        return { success: false, message: '用法: /skill disable <plugin-name>' };
    }

    const result = disableSkillPlugin(pluginName);

    if (!result.success) {
        return { success: false, message: chalk.red(`禁用失败: ${result.error}`) };
    }

    reloadCustomCommands();

    return { success: true, message: chalk.green(`✓ 已禁用: ${pluginName}`) };
}

/**
 * 刷新技能列表
 */
async function handleRefresh(): Promise<SkillCommandResult> {
    reloadCustomCommands();
    const skills = await loadCustomCommands();

    return {
        success: true,
        message: chalk.green(`✓ 已刷新技能列表，共 ${skills.length} 个技能`),
    };
}

/**
 * 列出已安装插件
 */
function handlePlugins(): SkillCommandResult {
    const plugins = listInstalledPlugins();

    if (plugins.length === 0) {
        return {
            success: true,
            message: '暂无已安装插件。\n\n使用 /skill install <path> 安装技能包。',
        };
    }

    const lines = [
        chalk.bold('已安装插件:'),
        '',
    ];

    for (const plugin of plugins) {
        const status = plugin.isEnabled ? chalk.green('✓') : chalk.gray('○');
        const scope = plugin.scope === 'project' ? chalk.cyan('[项目]') : chalk.blue('[用户]');
        lines.push(`  ${status} ${plugin.plugin} ${scope}`);
        lines.push(`    来源: ${plugin.marketplace}`);
        lines.push(`    技能: ${plugin.skills.join(', ') || '无'}`);
    }

    return { success: true, message: lines.join('\n') };
}

/**
 * 显示帮助
 */
function handleHelp(): SkillCommandResult {
    const help = `
${chalk.bold('技能管理命令')}

${chalk.cyan('用法:')} /skill <command> [options]

${chalk.cyan('命令:')}
  list              列出所有可用技能
  info <name>       显示技能详情
  install <source>  安装技能包
  uninstall <name>  卸载技能包
  enable <name>     启用技能
  disable <name>    禁用技能
  plugins           列出已安装插件
  refresh           刷新技能列表
  help              显示此帮助

${chalk.cyan('安装选项:')}
  --project         安装到项目级 (.ai-agent/)
  --force, -f       强制覆盖安装

${chalk.cyan('示例:')}
  /skill list
  /skill install ./my-skill
  /skill install github:user/skill-pack
  /skill uninstall my-skill
`;

    return { success: true, message: help.trim() };
}

// ============================================================
// 主入口
// ============================================================

/**
 * 执行技能命令
 */
export async function runSkillCommand(argsStr: string): Promise<string> {
    const { command, args, flags } = parseArgs(argsStr);

    let result: SkillCommandResult;

    switch (command.toLowerCase()) {
        case 'list':
        case 'ls':
            result = await handleList();
            break;

        case 'info':
        case 'show':
            result = await handleInfo(args[0] || '');
            break;

        case 'install':
        case 'add':
            result = await handleInstall(args[0] || '', flags);
            break;

        case 'uninstall':
        case 'remove':
        case 'rm':
            result = await handleUninstall(args[0] || '');
            break;

        case 'enable':
            result = handleEnable(args[0] || '');
            break;

        case 'disable':
            result = handleDisable(args[0] || '');
            break;

        case 'plugins':
        case 'installed':
            result = handlePlugins();
            break;

        case 'refresh':
        case 'reload':
            result = await handleRefresh();
            break;

        case 'help':
        case '':
            result = handleHelp();
            break;

        default:
            result = {
                success: false,
                message: `未知命令: ${command}\n\n使用 /skill help 查看帮助`,
            };
    }

    return result.message;
}

/**
 * 获取技能命令自动补全
 */
export function getSkillCommandCompletions(partial: string): string[] {
    const commands = [
        'list', 'info', 'install', 'uninstall',
        'enable', 'disable', 'plugins', 'refresh', 'help',
    ];

    if (!partial) return commands;

    return commands.filter(c => c.startsWith(partial.toLowerCase()));
}
