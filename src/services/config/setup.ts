/**
 * 交互式配置向导
 */

import enquirer from 'enquirer';
import chalk from 'chalk';
import type { Provider } from '../../core/types.js';
import { PRODUCT_NAME } from '../../core/constants.js';
import { DEFAULT_ENDPOINTS } from './types.js';
import { saveUserConfig, getConfigPath, type UserConfig } from './configStore.js';

type EnquirerPrompt<T> = { run(): Promise<T> };
type EnquirerClass<T> = new (options: Record<string, unknown>) => EnquirerPrompt<T>;
const { Select, Password, Input, Confirm } = enquirer as unknown as {
  Select: EnquirerClass<string>;
  Password: EnquirerClass<string>;
  Input: EnquirerClass<string>;
  Confirm: EnquirerClass<boolean>;
};

/**
 * 提供商选项
 */
const PROVIDER_CHOICES = [
    { name: 'anthropic', message: 'Anthropic Claude', hint: '推荐' },
    { name: 'openai', message: 'OpenAI GPT' },
    { name: 'gemini', message: 'Google Gemini' },
];

function isProvider(value: string): value is Provider {
  return value === 'anthropic' || value === 'openai' || value === 'gemini';
}

/**
 * 模型选项
 */
const MODEL_CHOICES: Record<Provider, Array<{ name: string; message: string; hint?: string }>> = {
    anthropic: [
        { name: 'claude-sonnet-4-5-20250929', message: 'Claude Sonnet 4.5', hint: '推荐' },
        { name: 'claude-3-5-sonnet-20241022', message: 'Claude 3.5 Sonnet' },
        { name: 'claude-3-opus-20240229', message: 'Claude 3 Opus' },
        { name: '__custom__', message: '自定义模型...', hint: '手动输入' },
    ],
    openai: [
        { name: 'gpt-4-turbo-preview', message: 'GPT-4 Turbo', hint: '推荐' },
        { name: 'gpt-4', message: 'GPT-4' },
        { name: 'gpt-3.5-turbo', message: 'GPT-3.5 Turbo' },
        { name: '__custom__', message: '自定义模型...', hint: '手动输入' },
    ],
    gemini: [
        { name: 'gemini-1.5-pro', message: 'Gemini 1.5 Pro', hint: '推荐' },
        { name: 'gemini-1.5-flash', message: 'Gemini 1.5 Flash' },
        { name: 'gemini-pro', message: 'Gemini Pro' },
        { name: '__custom__', message: '自定义模型...', hint: '手动输入' },
    ],
};

/**
 * 打印欢迎信息
 */
function printWelcome(): void {
    console.log();
    console.log(chalk.cyan.bold(`🤖 欢迎使用 ${PRODUCT_NAME}!`));
    console.log();
    console.log(chalk.yellow('检测到您尚未配置 API 密钥，请完成初始设置：'));
    console.log();
}

/**
 * 打印配置成功信息
 */
function printSuccess(): void {
    console.log();
    console.log(chalk.green.bold('✅ 配置已保存！'));
    console.log(chalk.gray(`   配置文件: ${getConfigPath()}`));
    console.log();
}

/**
 * 运行配置向导
 */
export async function runSetupWizard(): Promise<UserConfig | null> {
    try {
        printWelcome();

        // 1. 选择提供商
        const providerPrompt = new Select({
            name: 'provider',
            message: '选择 AI 提供商',
            choices: PROVIDER_CHOICES,
        });
        const providerRaw = await providerPrompt.run();
        if (!isProvider(providerRaw)) {
            throw new Error(`未知的提供商: ${providerRaw}`);
        }
        const provider: Provider = providerRaw;

        // 2. 输入 API Key
        const apiKeyPrompt = new Password({
            name: 'apiKey',
            message: `请输入 ${provider.toUpperCase()} API Key`,
            validate: (value: string) => {
                if (!value || value.trim().length < 5) {
                    return 'API Key 不能为空且长度至少为 10 个字符';
                }
                return true;
            },
        });
        const apiKey: string = await apiKeyPrompt.run();

        // 3. 选择模型
        const modelPrompt = new Select({
            name: 'model',
            message: '选择模型',
            choices: MODEL_CHOICES[provider],
        });
        let model: string = await modelPrompt.run();

        // 如果选择自定义模型，则让用户输入
        if (model === '__custom__') {
            const customModelPrompt = new Input({
                name: 'customModel',
                message: '请输入模型名称',
                validate: (value: string) => {
                    if (!value || value.trim().length < 1) {
                        return '模型名称不能为空';
                    }
                    return true;
                },
            });
            model = await customModelPrompt.run();
        }

        // 4. 询问是否使用第三方 API URL
        const useCustomUrlPrompt = new Confirm({
            name: 'useCustomUrl',
            message: '是否使用第三方 API 代理?',
            initial: false,
        });
        const useCustomUrl: boolean = await useCustomUrlPrompt.run();

        let baseUrl: string | undefined;
        if (useCustomUrl) {
            const urlPrompt = new Input({
                name: 'baseUrl',
                message: '请输入 API Base URL',
                initial: DEFAULT_ENDPOINTS[provider],
                validate: (value: string) => {
                    if (!value || !value.startsWith('http')) {
                        return '请输入有效的 URL (以 http:// 或 https:// 开头)';
                    }
                    return true;
                },
            });
            baseUrl = await urlPrompt.run();
        }

        // 5. 构建配置
        const config: UserConfig = {
            provider,
            apiKey: apiKey.trim(),
            model,
            ...(baseUrl && { baseUrl }),
        };

        // 6. 保存配置
        saveUserConfig(config);
        printSuccess();

        return config;
    } catch (error) {
        // 用户取消（Ctrl+C）
        const err = error as { message?: unknown; code?: unknown };
        const message = typeof err.message === 'string' ? err.message : '';
        const code = typeof err.code === 'string' ? err.code : '';
        if (message.includes('cancelled') || code === 'ERR_USE_AFTER_CLOSE') {
            console.log(chalk.yellow('\n配置已取消。'));
            return null;
        }
        throw error;
    }
}

/**
 * 运行重新配置向导
 */
export async function runReconfigureWizard(): Promise<UserConfig | null> {
    console.log();
    console.log(chalk.cyan.bold(`🔧 重新配置 ${PRODUCT_NAME}`));
    console.log();

    return runSetupWizard();
}
