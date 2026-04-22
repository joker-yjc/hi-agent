import { tool } from 'ai';
import { z } from 'zod';

/**
 * 网页内容获取工具
 * 使用原生 fetch 获取网页 HTML，并用 cheerio 提取纯文本
 */

export const fetchPage = tool({
  description: '获取指定 URL 的网页内容，并提取纯文本。适合深入阅读某个网页的详细内容。支持自动去除 HTML 标签和广告内容。',
  inputSchema: z.object({
    url: z.string().describe('要获取的网页 URL'),
    maxLength: z.number().optional().describe('返回文本的最大长度，默认 3000 字符'),
  }),
  execute: async ({ url, maxLength = 3000 }) => {
    console.log(`[工具调用] fetch_page: "${url}"`);
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return {
          url,
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          content: null,
        };
      }

      const html = await response.text();
      const text = extractTextFromHtml(html);
      const truncated = text.length > maxLength ? text.slice(0, maxLength) + '\n...[内容已截断]' : text;

      return {
        url,
        success: true,
        content: truncated,
        title: extractTitle(html),
        length: text.length,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        url,
        success: false,
        error: errorMessage.includes('timeout') ? '请求超时（10秒）' : errorMessage,
        content: null,
      };
    }
  },
});

/**
 * 从 HTML 中提取纯文本
 */
function extractTextFromHtml(html: string): string {
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  text = text
    .replace(/<\/(p|div|h[1-6]|li|tr|article|section|blockquote)>/gi, '\n')
    .replace(/<(br\s*\/?|hr\s*\/?)>/gi, '\n');

  text = text.replace(/<[^>]+>/g, ' ');

  const entities: Record<string, string> = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
    '&#39;': "'", '&nbsp;': ' ', '&#x2F;': '/', '&#x60;': '`',
    '&apos;': "'", '&mdash;': '\u2014', '&ndash;': '\u2013', '&hellip;': '\u2026',
    '&rsquo;': '\u2019', '&lsquo;': '\u2018', '&rdquo;': '\u201C', '&ldquo;': '\u201D',
  };
  for (const [entity, char] of Object.entries(entities)) {
    text = text.split(entity).join(char);
  }

  text = text
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}

/**
 * 提取网页标题
 */
function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match?.[1]?.trim() || '未知标题';
}