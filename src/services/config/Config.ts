/**
 * 配置管理
 */

import { config as dotenvConfig } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Provider } from '../../core/types.js';
import { EnvSchema, DEFAULT_MODELS, DEFAULT_ENDPOINTS } from './types.js';
import type { Config as IConfig } from './types.js';

// 获取当前文件所在目录（ESM）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 配置类 - 管理环境变量和 API 配置
 */
export class Config implements IConfig {
  provider: Provider;
  apiKey: string;
  model: string;
  baseUrl?: string;
  workdir: string;
  skillsDir: string;

  constructor() {
    // 加载 .env 文件
    dotenvConfig();

    // 验证环境变量
    const env = EnvSchema.parse(process.env);

    // 设置提供商
    this.provider = env.PROVIDER;

    // 设置工作目录
    this.workdir = process.cwd();

    // 设置技能目录（在项目根目录的 skills 文件夹）
    this.skillsDir = path.join(__dirname, '../../../skills');

    // 根据提供商获取配置
    switch (this.provider) {
      case 'anthropic':
        this.apiKey = env.ANTHROPIC_API_KEY || '';
        this.model = env.ANTHROPIC_MODEL || DEFAULT_MODELS.anthropic;
        this.baseUrl = env.ANTHROPIC_BASE_URL;
        break;

      case 'openai':
        this.apiKey = env.OPENAI_API_KEY || '';
        this.model = env.OPENAI_MODEL || DEFAULT_MODELS.openai;
        this.baseUrl = env.OPENAI_BASE_URL;
        break;

      case 'gemini':
        this.apiKey = env.GEMINI_API_KEY || '';
        this.model = env.GEMINI_MODEL || DEFAULT_MODELS.gemini;
        break;
    }

    // 验证 API Key
    if (!this.apiKey) {
      throw new Error(
        `${this.provider.toUpperCase()}_API_KEY 环境变量未设置。请在 .env 文件中配置。`
      );
    }
  }

  /**
   * 获取 API 端点
   */
  getApiEndpoint(): { baseUrl: string; fullEndpoint: string } {
    const baseUrl = this.baseUrl || DEFAULT_ENDPOINTS[this.provider];

    let fullEndpoint = baseUrl;
    switch (this.provider) {
      case 'anthropic':
        fullEndpoint = `${baseUrl}/v1/messages`;
        break;
      case 'openai':
        fullEndpoint = `${baseUrl}/chat/completions`;
        break;
      case 'gemini':
        fullEndpoint = `${baseUrl}/v1/models/${this.model}:generateContent`;
        break;
    }

    return { baseUrl, fullEndpoint };
  }

  /**
   * 获取提供商显示名称
   */
  getProviderDisplayName(): string {
    const names: Record<Provider, string> = {
      anthropic: 'Anthropic Claude',
      openai: 'OpenAI',
      gemini: 'Google Gemini',
    };
    return names[this.provider];
  }

  /**
   * 打印配置信息（用于调试）
   */
  toString(): string {
    const { baseUrl } = this.getApiEndpoint();
    return `Provider: ${this.provider}
Model: ${this.model}
Endpoint: ${baseUrl}
Workdir: ${this.workdir}
Skills: ${this.skillsDir}`;
  }
}

// 创建单例配置实例
let configInstance: Config | null = null;

export function getConfig(): Config {
  if (!configInstance) {
    configInstance = new Config();
  }
  return configInstance;
}

// 重置配置（主要用于测试）
export function resetConfig(): void {
  configInstance = null;
}
