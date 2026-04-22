import { tool } from 'ai';
import { z } from 'zod';

/**
 * 网页搜索工具
 * 支持 Tavily 真实搜索和内置模拟搜索两种模式
 * - 生产环境：设置 TAVILY_API_KEY 环境变量，使用 Tavily API
 * - 学习环境：无 API Key 时使用内置模拟搜索
 */

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

// 内置模拟搜索数据库（无 API Key 时使用）
const MOCK_SEARCH_DB: Record<string, SearchResult[]> = {
  'node.js': [
    { title: 'Node.js 官方网站', url: 'https://nodejs.org', snippet: 'Node.js 是一个基于 Chrome V8 引擎的 JavaScript 运行时。' },
    { title: 'Node.js 22 新特性详解', url: 'https://nodejs.org/en/blog', snippet: 'Node.js 22 引入了 require(esm)、WebSocket 客户端等新特性。' }
  ],
  'typescript': [
    { title: 'TypeScript 官方文档', url: 'https://www.typescriptlang.org', snippet: 'TypeScript 是 JavaScript 的超集，添加了类型系统。' },
    { title: 'TypeScript 5.0 新特性', url: 'https://devblogs.microsoft.com/typescript', snippet: '装饰器、const 类型参数、改进的 ESM 支持等。' }
  ],
  'react': [
    { title: 'React 官方文档', url: 'https://react.dev', snippet: 'React 是一个用于构建用户界面的 JavaScript 库。' },
    { title: 'React 19 新特性', url: 'https://react.dev/blog', snippet: 'React Compiler、Actions、use API 等新功能。' }
  ],
  'ai sdk': [
    { title: 'Vercel AI SDK 文档', url: 'https://sdk.vercel.ai/docs', snippet: 'AI SDK 是用于构建 AI 应用的 TypeScript 工具包。' },
    { title: 'AI SDK 快速入门', url: 'https://sdk.vercel.ai/docs/getting-started', snippet: '使用 generateText、streamText 等核心 API。' }
  ],
  'next.js': [
    { title: 'Next.js 官方文档', url: 'https://nextjs.org', snippet: 'Next.js 是一个 React 框架，支持 SSR、SSG 和 App Router。' },
    { title: 'Next.js 15 发布', url: 'https://nextjs.org/blog', snippet: 'Turbopack 稳定、React 19 支持、改进的缓存。' }
  ],
  'ollama': [
    { title: 'Ollama 官方网站', url: 'https://ollama.com', snippet: '在本地运行 LLM，支持 Llama、Qwen、DeepSeek 等模型。' },
    { title: 'Ollama GitHub', url: 'https://github.com/ollama/ollama', snippet: '开源项目，支持 macOS、Linux 和 Windows。' }
  ],
  'docker': [
    { title: 'Docker 官方文档', url: 'https://docs.docker.com', snippet: 'Docker 是一个容器化平台，用于构建、运行和分享应用。' },
    { title: 'Docker 入门指南', url: 'https://docs.docker.com/get-started', snippet: '学习如何使用 Docker 容器化你的应用。' }
  ]
};

/**
 * 使用 Tavily API 进行真实搜索
 */
async function tavilySearch(query: string, numResults: number): Promise<{ results: SearchResult[]; total: number }> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error('TAVILY_API_KEY not configured');
  }

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: numResults,
      include_answer: true,
      include_raw_content: false,
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`Tavily API error: ${response.status}`);
  }

  const data = await response.json() as { results: Array<{ title: string; url: string; content: string }> };
  return {
    results: data.results.map(r => ({
      title: r.title,
      url: r.url,
      snippet: r.content.slice(0, 200),
    })),
    total: data.results.length,
  };
}

/**
 * 使用内置数据库进行模拟搜索
 */
function mockSearch(query: string, numResults: number): { results: SearchResult[]; total: number } {
  const lowerQuery = query.toLowerCase();
  const results: SearchResult[] = [];
  const matchedKeys = new Set<string>();

  for (const [key, value] of Object.entries(MOCK_SEARCH_DB)) {
    if (lowerQuery.includes(key) || key.includes(lowerQuery)) {
      results.push(...value);
      matchedKeys.add(key);
    }
  }

  if (results.length === 0) {
    return {
      results: [
        { title: `关于 "${query}" 的搜索结果`, url: 'https://www.google.com/search?q=' + encodeURIComponent(query), snippet: `在 Google 上搜索 "${query}" 可获取更多信息。` },
        { title: '维基百科', url: 'https://zh.wikipedia.org/wiki/' + encodeURIComponent(query), snippet: `在维基百科上查找 "${query}" 的相关条目。` }
      ],
      total: 2,
    };
  }

  return {
    results: results.slice(0, numResults),
    total: results.length,
  };
}

export const webSearch = tool({
  description: '搜索网页获取信息。输入关键词，返回相关网页的标题、链接和摘要。适合获取实时信息或你不知道的知识。',
  inputSchema: z.object({
    query: z.string().describe('搜索关键词'),
    numResults: z.number().optional().describe('返回结果数量，默认 3 条'),
  }),
  execute: async ({ query, numResults = 3 }) => {
    console.log(`[工具调用] web_search: "${query}"`);

    try {
      // 优先使用 Tavily 真实搜索
      const { results, total } = await tavilySearch(query, numResults);
      console.log(`[工具调用] web_search: Tavily 返回 ${results.length} 条结果`);
      return { query, results, total, source: 'tavily' };
    } catch (error) {
      // Tavily 失败时降级到模拟搜索
      console.log(`[工具调用] web_search: 降级到模拟搜索`);
      const { results, total } = mockSearch(query, numResults);
      return { query, results, total, source: 'mock' };
    }
  },
});