/**
 * WebFetch 工具 - 获取网页内容并转换为 Markdown
 * 支持缓存、LLM 内容提取、跨域重定向检测
 */

import TurndownService from 'turndown';
import { getFetchCache } from './fetchCache.js';
import type { ProtocolAdapter } from '../../services/ai/adapters/base.js';

/**
 * 获取网页内容并转换为 Markdown
 * @param url 要获取的 URL
 * @param timeout 超时时间（毫秒）
 * @param maxLength 最大内容长度
 * @param prompt 内容提取提示词（可选，用 LLM 提取特定信息）
 * @param adapter 协议适配器（可选，用于 LLM 内容提取）
 */
export async function runWebFetch(
  url: string,
  timeout: number = 30000,
  maxLength: number = 50000,
  prompt?: string,
  adapter?: ProtocolAdapter
): Promise<string> {
  try {
    // 验证 URL
    let validUrl: URL;
    try {
      validUrl = new URL(url);
    } catch {
      return `错误: 无效的 URL "${url}"`;
    }

    // 只允许 http 和 https 协议
    if (!['http:', 'https:'].includes(validUrl.protocol)) {
      return `错误: 只支持 HTTP 和 HTTPS 协议，当前协议: ${validUrl.protocol}`;
    }

    // 检查缓存
    const cache = getFetchCache();
    const cachedContent = cache.get(url);
    if (cachedContent) {
      // 如果有 prompt 且有 adapter，对缓存内容也做 LLM 提取
      if (prompt && adapter) {
        return await extractWithLLM(cachedContent, prompt, url, adapter);
      }
      return cachedContent;
    }

    // 创建 AbortController 用于超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // 发起请求（手动处理重定向以检测跨域）
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AI-Agent-CLI/1.0)',
        },
      });

      clearTimeout(timeoutId);

      // 检测跨域重定向
      const responseUrl = new URL(response.url);
      if (responseUrl.host !== validUrl.host) {
        return `检测到跨域重定向: ${url} → ${response.url}\n请使用新 URL 重新请求: ${response.url}`;
      }

      // 检查响应状态
      if (!response.ok) {
        return `错误: HTTP ${response.status} ${response.statusText}`;
      }

      // 获取内容类型
      const contentType = response.headers.get('content-type') || '';

      // 只处理 HTML 和文本内容
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml') && !contentType.includes('text/plain')) {
        return `错误: 不支持的内容类型 "${contentType}"，只支持 HTML 和纯文本`;
      }

      // 读取响应内容
      const html = await response.text();

      // 检查内容长度
      if (html.length > maxLength * 2) {
        return `错误: 网页内容过大 (${html.length} 字符)，超过限制 (${maxLength * 2} 字符)`;
      }

      let markdown: string;

      // 纯文本直接返回
      if (contentType.includes('text/plain')) {
        markdown = html;
      } else {
        // 转换 HTML 到 Markdown
        const turndownService = new TurndownService({
          headingStyle: 'atx',
          codeBlockStyle: 'fenced',
        });
        markdown = turndownService.turndown(html);
      }

      // 限制输出长度
      if (markdown.length > maxLength) {
        markdown = markdown.slice(0, maxLength) + '\n\n...(内容已截断)';
      }

      // 构建完整结果
      const fullResult = `网页内容 (${url}):\n\n${markdown}\n\n---\n来源: ${url}\n内容长度: ${markdown.length} 字符`;

      // 写入缓存
      cache.set(url, fullResult);

      // 如果有 prompt，用 LLM 提取信息
      if (prompt && adapter) {
        return await extractWithLLM(fullResult, prompt, url, adapter);
      }

      return fullResult;

    } catch (error: unknown) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return `错误: 请求超时 (${timeout}ms)`;
        }
        return `错误: 网络请求失败: ${error.message}`;
      }
      return `错误: 未知错误: ${String(error)}`;
    }

  } catch (error: unknown) {
    if (error instanceof Error) {
      return `错误: ${error.message}`;
    }
    return `错误: 未知错误: ${String(error)}`;
  }
}

/**
 * 使用 LLM 从网页内容中提取指定信息
 */
async function extractWithLLM(
  content: string,
  prompt: string,
  url: string,
  adapter: ProtocolAdapter
): Promise<string> {
  try {
    const extractionPrompt = `以下是从 ${url} 获取的网页内容。请根据用户的要求提取信息。

用户要求: ${prompt}

网页内容:
${content}

请直接回答用户的问题，不要重复网页内容。`;

    const systemPrompt = '你是一个信息提取助手。从提供的网页内容中准确提取用户请求的信息。';
    const messages = [{ role: 'user' as const, content: extractionPrompt }];
    const rawResponse = await adapter.createMessage(
      systemPrompt,
      messages,
      adapter.convertTools([]),
      2000
    );

    // 提取文本响应
    const { textBlocks } = adapter.extractTextAndToolCalls(rawResponse);
    if (textBlocks.length > 0) {
      return textBlocks.join('\n\n');
    }

    return content;
  } catch (error: unknown) {
    // LLM 提取失败时返回原始内容
    const errorMsg = error instanceof Error ? error.message : String(error);
    return `${content}\n\n---\n注意: LLM 内容提取失败 (${errorMsg})，已返回完整内容`;
  }
}
