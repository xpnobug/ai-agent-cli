/**
 * WebFetch 工具 - 获取网页内容并转换为 Markdown
 */

import TurndownService from 'turndown';

/**
 * 获取网页内容并转换为 Markdown
 */
export async function runWebFetch(
  url: string,
  timeout: number = 30000,
  maxLength: number = 50000
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

    // 创建 AbortController 用于超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // 发起请求
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AI-Agent-CLI/1.0)',
        },
      });

      clearTimeout(timeoutId);


      // 检查响应状态
      if (!response.ok) {
        return `错误: HTTP ${response.status} ${response.statusText}`;
      }

      // 获取内容类型
      const contentType = response.headers.get('content-type') || '';

      // 只处理 HTML 内容
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
        return `错误: 不支持的内容类型 "${contentType}"，只支持 HTML`;
      }

      // 读取响应内容
      const html = await response.text();

      // 检查内容长度
      if (html.length > maxLength * 2) {
        return `错误: 网页内容过大 (${html.length} 字符)，超过限制 (${maxLength * 2} 字符)`;
      }

      // 转换 HTML 到 Markdown
      const turndownService = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced',
      });

      let markdown = turndownService.turndown(html);

      // 限制输出长度
      if (markdown.length > maxLength) {
        markdown = markdown.slice(0, maxLength) + '\n\n...(内容已截断)';
      }

      // 返回结果
      return `网页内容 (${url}):

${markdown}

---
来源: ${url}
内容长度: ${markdown.length} 字符`;

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
