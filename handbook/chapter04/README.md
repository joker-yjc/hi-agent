# 第 4 章：搭建最小 Chat 应用

> 本章目标：用 Next.js + Vercel AI SDK 搭建一个 AI 聊天应用的最小可用原型。
> 对应学习计划：Day 6

---

## 概念速览

### useChat — 把流式聊天变成 React Hook

`useChat` 是 `@ai-sdk/react` 提供的 React Hook，封装了：
- 消息状态管理（`messages` 数组）
- HTTP 请求发送
- 流式响应解析
- 状态追踪（loading/streaming/error）

不需要自己写 `fetch` + SSE 解析，9 行代码即可以跑：

```typescript
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'

export default function Page() {
  const { messages, sendMessage } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  })
  // messages: UIMessage[], sendMessage: ({text}) => void
}
```

### 架构拆解

```
┌──────────────────────────────────────────────────┐
│  浏览器                                          │
│  page.tsx ─ useChat(messages, sendMessage)       │
│     │  POST /api/chat { messages, modelId }      │
│     ▼                                            │
│  后端 (Node.js)                                  │
│  route.ts ─ streamText({ model, messages })      │
│     │  SSE: text/event-stream                    │
│     ▼                                            │
│  云端 API                                        │
│  通义千问 / DeepSeek / OpenAI                    │
└──────────────────────────────────────────────────┘
```

✅ **关键认知**：后端的 `route.ts` 是"翻译层"——把前端格式的消息转成 `streamText` 调用，再把 `streamText` 的结果转成 HTTP 流式响应。

### 一句话总结

> `useChat` Hook 封装了消息管理、HTTP 请求和流式解析。前端通过 `DefaultChatTransport` 发送消息，后端 `route.ts` 用 `streamText` 生成流式响应，`convertToModelMessages` 负责格式转换。

---

## 技术选型

| 组件 | 推荐 | 替代方案 |
|------|------|---------|
| 框架 | Next.js 16 App Router | Remix, Nuxt |
| Chat Hook | `@ai-sdk/react` 的 `useChat` | 自己用 fetch + SSE 写 |
| UI 库 | Ant Design / shadcn/ui | 原生 HTML + Tailwind |
| 后端 | Route Handler (`route.ts`) | Server Actions, API Routes |

---

## 代码骨架

### 后端：`src/app/api/chat/route.ts`（最小实现）

```typescript
import { streamText, convertToModelMessages } from 'ai'
import { NextRequest } from 'next/server'
import { qwen } from 'shared-utils'

export async function POST(req: NextRequest) {
  const { messages, modelId } = await req.json()

  const result = streamText({
    system: '你是一个金融分析师',
    messages: await convertToModelMessages(messages),
    model: qwen(modelId ?? 'qwen3-max'),
  })

  return result.toUIMessageStreamResponse()
}
```

⚠️ `convertToModelMessages()` 是 v6 新增的，用于将 `UIMessage[]` 转换为模型可用的格式。不要省略。

### 前端：`src/app/page.tsx`（最小实现）

```typescript
'use client'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'

export default function Page() {
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  })

  return (
    <div>
      {messages.map(m => (
        <div key={m.id}>{m.role}: {
          m.parts.map((p, i) => p.type === 'text' ? p.text : '').join('')
        }</div>
      ))}
      <form onSubmit={e => {
        e.preventDefault()
        const input = e.currentTarget.elements.namedItem('prompt') as HTMLInputElement
        sendMessage({ text: input.value })
        input.value = ''
      }}>
        <input name="prompt" />
        <button disabled={status === 'streaming' || status === 'submitted'}>发送</button>
      </form>
    </div>
  )
}
```

---

## 实战建议（Day 6 任务指南）

1. **先跑通"最小原型"**（20 分钟）
   - 照着上面的代码骨架把后端 route.ts 和前端 page.tsx 写出来
   - 核心目标：输入文字 → 发送 → 看到 AI 回复
   - 先不要加样式、Markdown、多模型——跑通链路最重要

2. **理解 UIMessage 格式**（10 分钟）
   - 打印 `messages` 看数据结构
   - 关键字段：`{ id, role, parts: [{ type, text }] }`
   - 区分 `UIMessage`（前端用）和 `ModelMessage`（后端用）

3. **（可选）加上 System Prompt**（5 分钟）
   - 给 route.ts 加上 `system: '你是一个前端技术顾问'`
   - 观察模型的回复有什么变化

---

## 踩坑记录

✅ **坑 1：useChat 的 status 值含义**

| status | 含义 | UI 应该怎么表现 |
|--------|------|---------------|
| `ready` | 空闲 | 正常状态 |
| `submitted` | 请求已发出，等待首个 Token | 显示"思考中"加载动画 |
| `streaming` | 正在接收流式响应 | 不需要额外加载指示器（消息在实时更新） |
| `error` | 发生错误 | 显示错误提示 + 重试按钮 |

⚠️ `streaming` 状态下不要再显示"AI 正在思考"——消息本身就在逐字出现，再加 loading 会误导用户。

✅ **坑 2：`convertToModelMessages` 不能省略**
v6 引入的 UIMessage 格式和 ModelMessage 格式不同，不转换会导致模型收到格式错误的消息。
→ route.ts 中 `streamText` 之前始终调用 `await convertToModelMessages(messages)`。

---

## 练习

### 基础练习
1. 搭建最小 Chat 应用：一个 `route.ts` + 一个 `page.tsx`，确认输入文字 → 发送 → 看到 AI 回复的完整链路能跑通
2. 在 `page.tsx` 中 `console.log(messages)`，观察 UIMessage 的数据结构（id/role/parts 等字段）
3. 给 `route.ts` 加上不同的 System Prompt，观察同一问题的回复变化

### 进阶挑战
1. 给前端添加 `status` 状态显示：`submitted` 时显示"AI 思考中"动画，`streaming` 时隐藏 loading（因为消息在实时更新）
2. 实现错误状态处理：API 失败时显示错误提示 + 重试按钮

### 思考题
1. 为什么 `useChat` 需要后端 `route.ts` 做中转，而不是前端直接调用 LLM API？（提示：API Key、CORS、数据安全）
2. `convertToModelMessages` 的作用是什么？如果不调用会发生什么？（提示：对比 v6 的 UIMessage 和 ModelMessage 格式差异）

---

## 延伸阅读

| 资料 | 推荐理由 |
|------|---------|
| [AI SDK useChat 文档](https://sdk.vercel.ai/docs/reference/ai-sdk-ui/use-chat) | 📖 useChat 完整 API 参考 |
| [AI SDK Next.js 指南](https://sdk.vercel.ai/docs/getting-started/nextjs) | 📖 Next.js 集成教程 |
| [Next.js Route Handler](https://nextjs.org/docs/app/building-your-application/routing/route-handlers) | 📖 route.ts 的官方文档 |
| 本仓库 `stage-3-chat-app/` | ✅ 完整实现，包含后续章节的所有功能 |

---

| [← 上一章：Vercel AI SDK 核心 API](../chapter03/README.md) | [下一章：消息渲染与交互体验 →](../chapter05/README.md) |
