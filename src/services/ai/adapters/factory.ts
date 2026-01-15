/**
 * 适配器工厂 - 根据提供商创建相应的适配器实例
 */

import type { Provider } from '../../../core/types.js';
import { ProtocolAdapter } from './base.js';
import { AnthropicAdapter } from './anthropic.js';
import { OpenAIAdapter } from './openai.js';
import { GeminiAdapter } from './gemini.js';

/**
 * 创建协议适配器
 */
export async function createAdapter(
  provider: Provider,
  apiKey: string,
  model: string,
  baseUrl?: string
): Promise<ProtocolAdapter> {
  let adapter: ProtocolAdapter;

  switch (provider) {
    case 'anthropic':
      adapter = new AnthropicAdapter(apiKey, model, baseUrl);
      break;

    case 'openai':
      adapter = new OpenAIAdapter(apiKey, model, baseUrl);
      break;

    case 'gemini':
      adapter = new GeminiAdapter(apiKey, model, baseUrl);
      break;

    default:
      throw new Error(`不支持的提供商: ${provider}`);
  }

  // 初始化客户端
  await adapter.initializeClient();

  return adapter;
}

/**
 * 导出所有适配器类（用于测试）
 */
export { ProtocolAdapter, AnthropicAdapter, OpenAIAdapter, GeminiAdapter };
