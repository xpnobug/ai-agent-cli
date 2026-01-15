/**
 * WebSearch 工具 - 搜索网络内容
 */

import * as cheerio from 'cheerio';

/**
 * 搜索结果
 */
interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * 搜索网络内容（使用 DuckDuckGo）
 */
export async function runWebSearch(
  query: string,
  maxResults: number = 5,
  timeout: number = 30000
): Promise<string> {
  try {
    // 验证查询
    if (!query || query.trim().length === 0) {
      return '错误: 搜索查询不能为空';
    }

    // 构建搜索 URL（使用 DuckDuckGo HTML 版本）
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    // 创建 AbortController 用于超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // 发起请求
      const response = await fetch(searchUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AI-Agent-CLI/1.0)',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return `错误: HTTP ${response.status} ${response.statusText}`;
      }


      // 解析 HTML
      const html = await response.text();
      const $ = cheerio.load(html);

      // 提取搜索结果
      const results: SearchResult[] = [];

      $('.result').each((_index, element) => {
        if (results.length >= maxResults) return false;

        const $result = $(element);
        const $link = $result.find('.result__a');
        const $snippet = $result.find('.result__snippet');

        const title = $link.text().trim();
        const url = $link.attr('href') || '';
        const snippet = $snippet.text().trim();

        if (title && url) {
          results.push({ title, url, snippet });
        }

        return undefined;
      });

      if (results.length === 0) {
        return `未找到相关结果: "${query}"`;
      }

      // 格式化输出
      let output = `搜索结果: "${query}"\n\n`;

      results.forEach((result, index) => {
        output += `${index + 1}. **${result.title}**\n`;
        output += `   URL: ${result.url}\n`;
        if (result.snippet) {
          output += `   ${result.snippet}\n`;
        }
        output += '\n';
      });

      output += `---\n找到 ${results.length} 个结果`;

      return output;

    } catch (error: unknown) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return `错误: 搜索超时 (${timeout}ms)`;
        }
        return `错误: 搜索失败: ${error.message}`;
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
