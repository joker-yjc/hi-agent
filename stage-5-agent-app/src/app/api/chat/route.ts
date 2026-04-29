/**
 * Agent Chat API Route — 带工具调用的多步推理聊天
 *
 * 定义 3 个工具：
 * - search_docs: 检索本地知识库文档
 * - web_search: Tavily 网页搜索
 * - fetch_page: 获取指定 URL 的网页内容
 */

import { streamText, tool, convertToModelMessages, stepCountIs } from "ai"
import { NextRequest } from "next/server"
import { qwen } from "shared-utils"
import { searchDocuments } from "@/utils/search"
import { z } from "zod"

const model = qwen()

const llmMapping = {
  "qwen3-max": "qwen3-max",
  "kimi-k2.5": "kimi-k2.5",
  "MiniMax-M2.5": "MiniMax-M2.5",
}

/**
 * Tavily 网页搜索
 */
async function tavilySearch(query: string, maxResults = 5): Promise<string> {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) {
    return "⚠️ 未配置 Tavily API Key，请在 .env 中添加 TAVILY_API_KEY 以启用网页搜索功能。"
  }

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        max_results: maxResults,
        search_depth: "basic",
      }),
    })

    if (!res.ok) {
      return `搜索失败: HTTP ${res.status}`
    }

    const data = (await res.json()) as {
      results?: Array<{ title: string; url: string; content: string; score: number }>
    }

    if (!data.results || data.results.length === 0) {
      return "未找到相关搜索结果。"
    }

    return data.results
      .map(
        (r, i) =>
          `[${i + 1}] ${r.title}\nURL: ${r.url}\n摘要: ${r.content}\n相关度: ${(r.score * 100).toFixed(1)}%`
      )
      .join("\n\n---\n\n")
  } catch (error) {
    return `搜索出错: ${error instanceof Error ? error.message : "未知错误"}`
  }
}

/**
 * 获取网页内容（服务端 fetch）
 */
async function fetchPageContent(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      return `获取网页失败: HTTP ${res.status}`
    }

    const html = await res.text()

    // 使用 RegExp 构造函数避免 TS 解析器误读 </script> 字面量
    const text = html
      .replace(new RegExp('<script[\\s\\S]*?</script>', 'gi'), '')
      .replace(new RegExp('<style[\\s\\S]*?</style>', 'gi'), '')
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()

    const maxLen = 3000
    return text.length > maxLen ? text.slice(0, maxLen) + `\n\n[内容已截断，原始长度: ${text.length} 字符]` : text
  } catch (error) {
    return `获取网页出错: ${error instanceof Error ? error.message : "未知错误"}`
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { messages, modelId } = body
  console.log("[Agent] 收到请求, 消息数:", messages?.length, "模型:", modelId)

  const result = streamText({
    model: model(llmMapping[modelId as keyof typeof llmMapping] ?? llmMapping["qwen3-max"]),
    system: `你是一个智能 Agent 助手。你可以通过调用工具来帮助用户解决问题。

可用工具：
1. search_docs — 检索本地知识库文档。当用户询问已上传文档中的内容时使用。
2. web_search — 搜索互联网。当本地知识库中没有相关信息，或用户询问实时信息、新闻、外部资料时使用。
3. fetch_page — 获取指定网页的完整内容。当需要深入阅读某个网页的详细信息时使用。

工作策略：
- 优先使用 search_docs 检索本地知识库
- 如果本地知识库没有相关信息，再使用 web_search
- 如果需要深入查看某个网页，使用 fetch_page
- 向用户展示你的思考过程：先说明要调用什么工具，然后展示结果，最后给出综合回答`,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(5),
    tools: {
      search_docs: tool({
        description: "检索本地知识库文档，查找与问题相关的文本片段。",
        inputSchema: z.object({
          query: z.string().describe("搜索关键词或问题"),
          topK: z.number().optional().describe("返回结果数量，默认 5"),
        }),
        execute: async ({ query, topK = 5 }) => {
          console.log("[Agent] 调用工具: search_docs, query:", query)
          const results = await searchDocuments(query, { topK, minScore: 0.5 })
          console.log("[Agent] search_docs 返回:", results.length, "条结果")

          if (results.length === 0) {
            return "本地知识库中未找到相关内容。"
          }

          return results
            .map(
              (r, i) =>
                `[${i + 1}] ${r.fileName} (相似度: ${(r.score * 100).toFixed(1)}%)\n${r.text}`
            )
            .join("\n\n---\n\n")
        },
      }),
      web_search: tool({
        description: "使用 Tavily 搜索引擎搜索互联网内容。",
        inputSchema: z.object({
          query: z.string().describe("搜索关键词"),
          maxResults: z.number().optional().describe("返回结果数量，默认 5"),
        }),
        execute: async ({ query, maxResults = 5 }) => {
          console.log("[Agent] 调用工具: web_search, query:", query)
          const result = await tavilySearch(query, maxResults)
          console.log("[Agent] web_search 返回, 长度:", result.length)
          return result
        },
      }),
      fetch_page: tool({
        description: "获取指定 URL 网页的文本内容。",
        inputSchema: z.object({
          url: z.string().describe("网页 URL"),
        }),
        execute: async ({ url }) => {
          console.log("[Agent] 调用工具: fetch_page, url:", url)
          const result = await fetchPageContent(url)
          console.log("[Agent] fetch_page 返回, 长度:", result.length)
          return result
        },
      }),
    },
  })

  return result.toUIMessageStreamResponse()
}
