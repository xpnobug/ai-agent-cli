/**
 * 配置存储服务 - 管理用户级配置文件
 */

import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';
import type { Provider } from '../../core/types.js';

/**
 * 用户配置接口
 */
export interface UserConfig {
    provider: Provider;
    apiKey: string;
    model: string;
    baseUrl?: string;
}

/**
 * 获取配置目录路径
 */
export function getConfigDir(): string {
    return path.join(os.homedir(), '.ai-agent');
}

/**
 * 获取配置文件路径
 */
export function getConfigPath(): string {
    return path.join(getConfigDir(), 'config.json');
}

/**
 * 检查配置是否存在
 */
export function hasConfig(): boolean {
    return fs.existsSync(getConfigPath());
}

/**
 * 读取配置
 */
export function loadUserConfig(): UserConfig | null {
    try {
        const configPath = getConfigPath();
        if (!fs.existsSync(configPath)) {
            return null;
        }
        const content = fs.readFileSync(configPath, 'utf-8');
        return JSON.parse(content) as UserConfig;
    } catch {
        return null;
    }
}

/**
 * 保存配置
 */
export function saveUserConfig(config: UserConfig): void {
    const configDir = getConfigDir();

    // 确保目录存在
    fs.ensureDirSync(configDir);

    // 写入配置文件
    const configPath = getConfigPath();
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * 删除配置
 */
export function removeUserConfig(): boolean {
    try {
        const configPath = getConfigPath();
        if (fs.existsSync(configPath)) {
            fs.unlinkSync(configPath);
            return true;
        }
        return false;
    } catch {
        return false;
    }
}

/**
 * 获取配置摘要（隐藏敏感信息）
 */
export function getConfigSummary(config: UserConfig): string {
    const maskedKey = config.apiKey.slice(0, 8) + '...' + config.apiKey.slice(-4);
    return `提供商: ${config.provider}
模型: ${config.model}
API Key: ${maskedKey}${config.baseUrl ? `\nAPI URL: ${config.baseUrl}` : ''}`;
}
