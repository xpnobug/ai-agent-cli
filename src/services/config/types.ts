/**
 * 配置类型定义
 */

import { z } from 'zod';
import type { Provider } from '../../core/types.js';

// 环境变量 schema
export const EnvSchema = z.object({
  PROVIDER: z.enum(['anthropic', 'openai', 'gemini']).default('anthropic'),

  // Anthropic
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().optional(),
  ANTHROPIC_BASE_URL: z.string().optional(),

  // OpenAI
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  OPENAI_BASE_URL: z.string().optional(),

  // Gemini
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().optional(),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

// 配置接口
export interface Config {
  provider: Provider;
  apiKey: string;
  model: string;
  baseUrl?: string;
  workdir: string;
  skillsDir: string;
}

// 配置选项接口
export interface ConfigOptions {
  provider?: Provider;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  workdir?: string;
  skillsDir?: string;
}

// 默认模型名称
export const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: 'claude-sonnet-4-5-20250929',
  openai: 'gpt-4-turbo-preview',
  gemini: 'gemini-pro',
};

// API 端点
export const DEFAULT_ENDPOINTS: Record<Provider, string> = {
  anthropic: 'https://api.anthropic.com',
  openai: 'https://api.openai.com/v1',
  gemini: 'https://generativelanguage.googleapis.com',
};
