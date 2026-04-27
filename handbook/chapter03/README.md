# 第 3 章：Vercel AI SDK 核心 API

> 本章目标：掌握 Vercel AI SDK 的三个核心 API——`generateText`、`streamText`、结构化输出。这是前端生态下调用 LLM 的标准方式。
> 对应学习计划：Day 3-5

---

## 概念速览

### 为什么用 Vercel AI SDK 而不是直接调 HTTP API？

| 直接用 fetch() 调 API | 用 Vercel AI SDK |
|----------------------|-----------------|
| 每种模型的 API 格式不同 | 一套 TypeScript 接口适配所有模型 |
| 需要自己实现流式解析 | `streamText` 一行搞定流式输出 |
| 需要自己写重试/错误处理逻辑框架 | 框架级错误处理和类型安全 |
| 不够类型安全 | 完整的 TypeScript 类型定义 |

✅ **本质**：Vercel AI SDK 是 LLM 调用的"Express.js"——不取代 HTTP，而是给 HTTP 调用加了一层前端友好的抽象。

### 四个核心 API 速查

| API | 用途 | 返回方式 | 使用场景 |
|-----|------|---------|---------|
| `generateText()` | 文本生成 | 一次性返回完整文本 | 非实时场景（总结、翻译） |
| `streamText()` | 流式生成 | 逐 Token 流式返回 | 聊天应用、实时生成 |
| `embed()` / `embedMany()` | 文本转向量 | 返回 Embedding 向量 | RAG 检索（第 7 章） |
| `tool()` | 定义工具 | 返回工具对象 | Agent 开发（第 10 章） |

### ⚠️ generateObject 已废弃

```typescript
// ❌ AI SDK v6 中已废弃，不要用
import { generateObject } from 'ai'

// ✅ 正确的替代方式
import { generateText, Output } from 'ai'
const result = await generateText({
  model: qwen('qwen3-max'),
  output: Output.object({ schema: myZodSchema }),
  prompt: '...',
})
```

### 一句话总结

> Vercel AI SDK 用一套 TypeScript 接口统一了所有 LLM 的调用方式。generateText 用于即时响应，streamText 用于流式对话，Output.object() 替代了废弃的 generateObject。

---

## 技术选型

### Provider 选型（前端开发者视角）

| Provider | 依赖 | 适用于 |
|----------|------|--------|
| `@ai-sdk/openai` | `@ai-sdk/openai` | OpenAI + DeepSeek（OpenAI 兼容格式） |
| `@ai-sdk/alibaba` | `@ai-sdk/alibaba` | 阿里云通义千问 |
| `@ai-sdk/deepseek` | `@ai-sdk/deepseek` | DeepSeek 专用 |
| `@ai-sdk/anthropic` | `@ai-sdk/anthropic` | Claude 系列 |

✅ **推荐学习路径**：
- 低成本练习 → DeepSeek（`@ai-sdk/deepseek` 或 `@ai-sdk/openai` 兼容模式）
- 国内开发 → 阿里云通义千问（`@ai-sdk/alibaba`）
- 生产级应用 → OpenAI + Claude 组合

### 本仓库的 Provider 封装

本仓库已经在 `packages/shared-utils/` 做了一个统一 Provider 抽象层：

```typescript
import { qwen, deepseek, openai, ollama } from 'shared-utils'
// 环境变量自动从根目录 .env 加载
```

---

## 代码骨架

### 1. generateText — 基础文本生成（Day 3 用）

```typescript
// stage-2-api/01-generate-text.ts（完整代码见原文件）
import { generateText } from 'ai'
import { qwen } from 'shared-utils'

const result = await generateText({
  model: qwen('qwen3-max'),
  system: '你是一个前端技术顾问',
  prompt: '解释 React 的 Fiber 架构，用中文回答，不超过 200 字',
})

console.log(result.text)           // 生成的文本
console.log(result.usage)          // Token 用量
// { promptTokens: 42, completionTokens: 180, totalTokens: 222 }
```

### 2. streamText — 流式输出（Day 4 用）

```typescript
// stage-2-api/02-stream-text.ts
import { streamText } from 'ai'
import { qwen } from 'shared-utils'

const result = await streamText({
  model: qwen('qwen3-max'),
  system: '你是一个前端技术顾问',
  prompt: '解释 React 的 Fiber 架构',
})

// 逐字打印
for await (const chunk of result.textStream) {
  process.stdout.write(chunk) // 终端逐字显示
}
```

### 3. 多轮对话 — 维护 messages 数组（Day 4 进阶）

```typescript
// stage-2-api/03-chat-cli.ts
import { generateText } from 'ai'

const messages = [
  { role: 'system', content: '你是前端技术顾问' },
]

// 每轮对话 append 到 messages
messages.push({ role: 'user', content: '什么是闭包？' })
const result = await generateText({ model, messages })
messages.push({ role: 'assistant', content: result.text })

// 下一轮
messages.push({ role: 'user', content: '用 React 举例' })
// ... 模型能看到上一轮的对话
```

### 4. 结构化输出 — Output.object()（Day 5 用）

```typescript
// stage-2-api/04-generate-object.ts
import { z } from 'zod'
import { generateText, Output } from 'ai'

const ArticleSummary = z.object({
  title: z.string(),
  summary: z.string(),
  keywords: z.array(z.string()),
  sentiment: z.enum(['positive', 'negative', 'neutral']),
})

const result = await generateText({
  model: qwen('qwen3-max'),
  output: Output.object({ schema: ArticleSummary }),
  prompt: `提取下面新闻的摘要：
    中国新能源汽车出口量同比增长 45%，
    其中比亚迪出口量首次超过特斯拉...`,
})

// result.output 已是类型安全的 { title, summary, keywords, sentiment }
```

---

## 实战建议（Day 3-5 任务指南）

### Day 3：第一次 API 调用
1. 初始化项目（参考 `stage-2-api/` 的 `package.json`）
2. 先把根目录 `.env` 配好 API Key
3. 写 `01-generate-text.ts`：
   - 先跑通最简单的调用
   - 然后切换模型看看 `usage` 差异
   - 打出 `result.usage` 直观感受 Token 消耗

### Day 4：流式输出 + 多轮对话
1. 写 `02-stream-text.ts`：用 `for await` 循环吃 `textStream`
2. 写 `03-chat-cli.ts`：
   - 用 `readline` 做命令行交互
   - **重点**：自己维护 `messages` 数组，不要用任何第三方对话管理库
   - 确保模型能看到之前聊过的内容（这是理解"记忆"的第一步）

### Day 5：结构化输出 + 本地模型
1. 写 `04-generate-object.ts`：
   - 用 Zod 定义 Schema
   - 用 `Output.object()` 而不是 `generateObject()`
   - 测试：输入一段新闻，提取结构化摘要
2. 写 `05-ollama-chat.ts`：
   - 确保 Ollama 已启动 + 已拉取模型
   - 对比本地模型和云端 API 的速度/质量差异

---

## 踩坑记录

✅ **坑 1：`@ai-sdk/alibaba` 国内 API Key 需要手动设置 baseURL**

默认的 baseURL 是国际站的，国内百炼平台用户需要设置 `ALIBABA_BASE_URL`：
```
ALIBABA_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
```
→ 已在 `shared-utils/qwen.ts` 中统一处理。

✅ **坑 2：用阿里云模型做结构化输出，Prompt 里必须包含 "JSON" 关键词**
`@ai-sdk/alibaba` 会自动发送 `response_format: { type: "json_schema" }`，但阿里云 API 还需要 Prompt 中有 "JSON" 字样才会生效。
→ **怎么绕**：Prompt 写 `"请以 JSON 格式返回..."` 或 `"按以下 JSON Schema 输出..."`

✅ **坑 3：AI SDK v6 的 `generateObject` 已废弃**
各种教程还在用 `generateObject()`，但 v6 源码已标注 `@deprecated`。
→ **怎么绕**：统一使用 `generateText` + `Output.object()`，本手册所有示例都是这个用法。

---

## 练习

### 基础练习
1. 用 `generateText` 调用任意模型，打印 `result.text` 和 `result.usage`，确认 Token 计数逻辑
2. 用 `streamText` 实现流式输出，用 `for await` 逐字打印到终端
3. 定义一个 Zod Schema（如文章摘要：title/summary/keywords/sentiment），用 `Output.object()` 让模型返回结构化数据

### 进阶挑战
1. 实现一个命令行多轮对话程序（参考 `stage-2-api/03-chat-cli.ts`），自己维护 `messages` 数组，确保模型能看到上下文
2. 用 Ollama 本地模型运行同样的 Prompt，对比云端 API 和本地模型的速度/质量差异

### 思考题
1. 为什么 AI SDK 要把 `generateText` 和 `streamText` 分成两个函数，而不是一个函数加个参数控制？
2. 结构化输出时，如果模型返回的数据不符合 Zod Schema，AI SDK 会怎么处理？（提示：查文档或做实验验证）

---

## 延伸阅读

| 资料 | 推荐理由 |
|------|---------|
| [Vercel AI SDK 官方文档](https://sdk.vercel.ai/docs) | 📖 核心文档入口 |
| [AI SDK generateText](https://sdk.vercel.ai/docs/reference/ai-sdk-core/generate-text) | 📖 generateText API 参考 |
| [AI SDK streamText](https://sdk.vercel.ai/docs/reference/ai-sdk-core/stream-text) | 📖 streamText API 参考 |
| [AI SDK 结构化输出](https://sdk.vercel.ai/docs/ai-sdk-core/generating-structured-data) | 📖 Output.object 完整文档 |
| [Zod 文档](https://zod.dev) | 📖 Schema 验证库，后续大量使用 |
| [Ollama 模型库](https://ollama.com/library) | 本地模型列表，推荐 qwen3:8b |
| 本仓库 `stage-2-api/` 的 5 个脚本 | ✅ 可直接运行的完整示例 |

---

| [← 上一章：Prompt Engineering 实战](../chapter02/README.md) | [下一章：搭建最小 Chat 应用 →](../chapter04/README.md) |
