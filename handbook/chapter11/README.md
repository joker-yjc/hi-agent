# 第 11 章：构建实用 Agent

> 本章目标：从"玩具示例"到"能用"——构建带搜索、数据查询等真正有用的 Agent，并学会错误处理和降级策略。
> 对应学习计划：Day 15

---

## 概念速览

### 什么让一个 Agent "实用"

| 特征 | 为什么重要 | 如何实现 |
|------|----------|---------|
| **有实际能力的工具** | 不只是 `getTime()` | 接真实 API（搜索、数据查询等） |
| **错误处理** | API 会挂，网络会卡 | `try-catch` + 降级返回 |
| **超时控制** | 外部 API 可能卡住 | `AbortSignal.timeout()` |
| **Prompt 外置** | Prompt 会频繁调整 | 从单独文件读取 |

---

## 一句话总结

实用 Agent 需要真实 API 能力、错误处理、超时控制和 Prompt 外置。工具出错时返回 `{ error }` 对象而非抛异常，让 LLM 自己决定下一步——这是 Agent 的"韧性"来源。

---

## 技术选型

### 网页搜索 API

| API | 免费额度 | 特点 |
|-----|---------|------|
| **Tavily** | 1000 次/月 | AI 友好，搜索结果预处理过 |
| SerpAPI | 100 次/月 | 传统搜索引擎结果 |
| Brave Search | 2000 次/月 | 隐私友好 |

### 学习阶段的 Mock 策略

没有 API Key 时，用 Mock 数据模拟搜索行为：

```typescript
// 优先用真实 API，无 Key 时用 Mock
if (process.env.SEARCH_API_KEY) {
  // 真实搜索
} else {
  // Mock：返回预设结果
}
```

这样可以先跑通 Agent 的完整决策链，之后再接入真实 API。

---

## 代码骨架

### 1. 网页搜索 Agent（完整链路）

```typescript
// stage-5-agent/03-web-agent.ts
const webSearch = tool({
  description: '搜索网页获取最新信息。参数：query - 搜索关键词',
  parameters: z.object({ query: z.string() }),
  execute: async ({ query }) => {
    // 真实搜索（有 API Key 时）
    if (process.env.TAVILY_API_KEY) {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY, query }),
      })
      return res.json()
    }
    // Mock 降级
    return { results: [{ title: `关于"${query}"的搜索结果`, content: '这是模拟的搜索结果...' }] }
  },
})

const fetchPage = tool({
  description: '获取指定 URL 的网页内容',
  parameters: z.object({ url: z.string() }),
  execute: async ({ url }) => {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    return res.text()
  },
})
```

### 2. 工具的超时与错误处理模式

```typescript
const robustTool = tool({
  description: '...',
  parameters: z.object({ /* ... */ }),
  execute: async (params) => {
    try {
      const res = await fetch(apiUrl, {
        signal: AbortSignal.timeout(5000), // 5 秒超时
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    } catch (error) {
      // 返回错误信息让 LLM 知道出事了，它可能换个工具继续
      return { error: String(error), fallback: true }
    }
  },
})
```

### 3. Prompt 外置模式

```typescript
// prompts/web-agent.md
// 你是一个网络研究助手。使用搜索工具获取信息，
// 不要编造你不知道的内容。如果搜索失败，直接告诉用户。

import { readFileSync } from 'fs'
const systemPrompt = readFileSync('./prompts/web-agent.md', 'utf-8')
```

---

## 实战建议（Day 15 任务指南）

1. **写 03-web-agent.ts**（15 分钟）
   - 实现 `web_search` + `fetch_page` 两个工具
   - 没 API Key 就先 Mock，重要的是跑通 Agent 决策链
   - 测试：问"最近前端有什么新框架？"

2. **写 04-data-agent.ts**（15 分钟）
   - 用本地 JSON 文件做"数据库"
   - 工具 `query_data` 支持条件搜索
   - 测试："帮我找价格低于 50 元的商品"

3. **加入错误处理**（5 分钟）
   - 每个工具加 try-catch
   - 工具调用失败时返回 `{ error: '...' }` 让 LLM 自己决定下一步

4. **将 System Prompt 移到独立文件**（5 分钟）
   - 创建 `prompts/` 目录
   - 好处：改 Prompt 不用改代码，还可以 A/B 测试

---

## 练习

### 基础练习

1. 实现 `03-web-agent.ts`：定义 `webSearch` 和 `fetchPage` 两个工具，无 API Key 时用 Mock 数据，测试"最近前端有什么新框架"
2. 为所有工具添加 `try-catch` 和 `AbortSignal.timeout(5000)`，模拟网络超时场景，观察 Agent 是否会卡死
3. 将 System Prompt 移到 `prompts/web-agent.md` 文件，用 `readFileSync` 读取，测试修改 Prompt 无需重启代码

### 进阶挑战

1. 实现 `04-data-agent.ts`：用本地 JSON 文件模拟数据库，支持按价格、分类等条件查询，测试"帮我找价格低于 50 元的商品"
2. 设计统一的工具返回格式 `{ success, data, error }`，在主循环中根据 `success` 决定展示结果还是提示错误

### 思考题

1. 为什么说"Mock 数据跑通决策链"比"等 API Key 到了再开始"更重要？
2. Prompt 外置除了方便修改，还有什么好处？（提示：版本控制、A/B 测试、多语言）

---

## 踩坑记录

✅ **坑 1：没有超时控制的 fetch 会让 Agent 卡死**
外部 API 无响应时，工具会无限等待。
→ **怎么绕**：每个 fetch 都加 `signal: AbortSignal.timeout(5000)`。

✅ **坑 2：把错误信息返回给 LLM，比 `throw Error` 更好**
`throw Error` 会导致工具调用整体失败，Agent 也停下来。
`return { error: '...' }` 让 LLM 知道工具出了状况，它可能换一个工具继续。
→ **设计模式**：工具的 execute 中统一返回对象 `{ success, data, error }`。

---

## 延伸阅读

| 资料 | 推荐理由 |
|------|---------|
| [Tavily API 文档](https://docs.tavily.com/) | 📖 AI 搜索 API |
| [Brave Search API](https://brave.com/search/api/) | 📖 隐私友好的搜索 API |
| 本仓库 `stage-5-agent/03-web-agent.ts` | ✅ 网页搜索 Agent |
| 本仓库 `stage-5-agent/04-data-agent.ts` | ✅ 数据查询 Agent |
| 本仓库 `stage-5-agent/tools/` | ✅ 工具模块化实现 |

---

| [← 上一章：Agent 基础与 Tool Calling](../chapter10/) | [下一章：Agent 记忆系统（短期记忆）→](../chapter12/) |
