# 第 9 章：RAG 完整管道

> 本章目标：把文档分块、向量搜索、LLM 生成串成一条完整的 RAG 问答管道，并整合到 Web 界面中。
> 对应学习计划：Day 12-13

---

## 概念速览

### RAG 管道的 4 个步骤

```
步骤 1：问题 → Embedding（向量化）
    ↓
步骤 2：向量搜索 → Top-K 相关块
    ↓
步骤 3：相关块 + 用户问题 → 拼入 System Prompt
    ↓
步骤 4：LLM 基于上下文 → 生成回答 + 标注引用来源
```

### 为什么要标注引用来源？

这是 RAG 区别于普通 ChatGPT 回答的关键特征：
- 用户能**验证**信息的来源
- 发现错误时可以**溯源**
- 增强对系统的**信任**

## 架构图：RAG 完整数据流

```
┌─────────────┐    ┌──────────┐    ┌─────────────┐
│   用户提问   │───→│ Embedding│───→│  向量搜索   │
└─────────────┘    └──────────┘    └──────┬──────┘
                                          │
┌─────────────┐    ┌──────────┐          │
│   文档分块   │───→│ Embedding│──────────┘
└─────────────┘    └──────────┘    ┌──────┴──────┐
                                   │ Top-K 相关块 │
                                   └──────┬──────┘
                                          ▼
┌─────────────────────────────────────────────────────┐
│  System Prompt（上下文注入）                          │
│  ─────────────────────────────────────────────────  │
│  参考资料：                                          │
│  [参考 1，来源: xxx.md] ...内容...                   │
│  [参考 2，来源: yyy.md] ...内容...                   │
│                                                      │
│  基于以上资料回答问题，并标注引用来源。               │
│  用户问题：...                                       │
└────────────────────────┬────────────────────────────┘
                         ▼
                  ┌────────────┐
                  │  LLM 生成  │
                  │ + 引用标注  │
                  └────────────┘
```

---

## 一句话总结

RAG 管道的四步走：问题向量化 → 向量搜索找相关块 → 相关块拼入 Prompt → LLM 基于上下文生成带引用的回答。标注来源是 RAG 与普通 Chat 的核心区别。

---

## 技术选型

### Web 端 RAG 的架构选择

| 方案 | 适用场景 | 复杂度 |
|------|---------|--------|
| **服务端 RAG**（全在 route.ts 中处理） | 学习阶段、小规模项目 | 低 |
| 独立向量服务 | 中大规模 | 中 |
| 向量数据库（pgvector/Weaviate） | 生产级 | 高 |

✅ **学习阶段**：用方案 A——所有 RAG 逻辑都在 Next.js 的 route.ts 中完成。

---

## 代码骨架

### 1. 完整的 RAG 问答脚本（命令行版）

```typescript
// stage-4-rag/06-rag-qa.ts
import { embed, generateText } from 'ai'
import { openai, qwen } from 'shared-utils'

const index = JSON.parse(readFileSync('index.json', 'utf-8'))

async function ragQuery(question: string) {
  // 步骤 1: 问题向量化
  const { embedding } = await embed({
    model: openai.embedding('text-embedding-v2'),
    value: question,
  })

  // 步骤 2: 向量搜索 + 过滤
  const topChunks = index
    .map((chunk: any) => ({
      ...chunk,
      score: cosineSimilarity(embedding, chunk.embedding),
    }))
    .sort((a: any, b: any) => b.score - a.score)
    .filter((c: any) => c.score > 0.3)
    .slice(0, 3)

  if (topChunks.length === 0) {
    return '未找到相关信息。'
  }

  // 步骤 3: 拼接上下文
  const context = topChunks
    .map((c: any, i: number) => `[参考 ${i + 1}，来源: ${c.source}]\n${c.content}`)
    .join('\n\n')

  // 步骤 4: LLM 生成 + 引用标注
  const result = await generateText({
    model: qwen('qwen3-max'),
    system: `你是一个基于文档的问答助手。请根据以下参考资料回答问题。
    如果资料中没有相关信息，请明确说"未找到相关信息"。
    回答时请引用参考编号。

    参考资料：
    ${context}`,
    prompt: question,
  })

  return result.text
}
```

### 2. Web 端 — 在 Route Handler 中集成 RAG

```typescript
// src/app/api/chat/route.ts (RAG 版本)
export async function POST(req: NextRequest) {
  const { messages, modelId } = await req.json()
  const userMessage = messages[messages.length - 1]

  // RAG 检索
  const { embedding } = await embed({
    model: openaiCompat.embedding('text-embedding-v2'),
    value: userMessage.content,
  })

  const topChunks = searchIndex(embedding, indexData, 3)

  // 拼入 System Prompt
  const ragContext = topChunks
    .map((c, i) => `[参考 ${i + 1}]\n${c.content}`)
    .join('\n\n')

  const result = streamText({
    system: `参考资料：\n${ragContext}\n\n基于以上资料回答问题，并标注引用来源。`,
    messages: await convertToModelMessages(messages),
    model: qwen(modelId ?? 'qwen3-max'),
  })

  return result.toUIMessageStreamResponse()
}
```

---

## 实战建议（Day 12-13 任务指南）

### Day 12：跑通 RAG 命令行管道
1. 写 `05-search.ts`：
   - 加载 index.json
   - 把问题转 Embedding
   - 计算所有块的相似度
   - 打印 Top-3 的得分和内容

2. 写 `06-rag-qa.ts`：
   - 串起搜索 → 拼接 → 生成
   - 重点：System Prompt 中明确要求"标注引用来源"
   - 测试两个场景：
     - 知识库中有答案的（"React Hooks 的规则是什么？"）
     - 知识库中没有的（"如何烤披萨？"）→ 应该回复"未找到相关信息"

### Day 13：把 RAG 整合到 Web
1. 在 `stage-3-chat-app` 的基础上改造：
   - 创建文档上传页面（Ant Design Dragger）
   - 上传时触发：提取文本 → 分块 → Embedding → 存索引
2. 修改 `route.ts`：
   - 每次收到用户消息，先执行 RAG 检索
   - 把相关块拼入 System Prompt
3. 在 UI 中显示引用来源：
   - AI 回复中包含 `[参考 1]`、`[参考 2]` 等标记
   - 在回复下方展示可折叠的原文引用区域

---

## 练习

### 基础练习

1. 在第 8 章的索引基础上，写 `05-search.ts`：输入问题 → Embedding → 计算与所有块的相似度 → 打印 Top-3 的 `score`、`source` 和前 100 字内容
2. 写 `06-rag-qa.ts`：串联搜索 → 拼接上下文 → `generateText` 生成回答，测试"知识库中有答案"和"知识库中无答案"两种场景
3. 修改 System Prompt，要求 LLM 在回答末尾列出所有引用的参考编号，对比不标注来源时的回答差异

### 进阶挑战

1. 把 RAG 集成到 `stage-3-chat-app` 的 `route.ts` 中：每次收到用户消息先执行 RAG 检索，再将相关块拼入 System Prompt
2. 实现"引用折叠 UI"：AI 回复下方展示可展开的区域，显示 `[参考 N]` 对应的原文片段

### 思考题

1. 如果 Top-3 块之间存在矛盾信息，LLM 会怎么处理？如何在 System Prompt 中引导它处理冲突？
2. RAG 的"幻觉"和普通 LLM 的"幻觉"有什么不同？RAG 能完全消除幻觉吗？

---

## 踩坑记录

✅ **坑 1：相似度阈值设置不当**

阈值太低（0.1）→ 无关结果混进来，LLM 可能会被误导  
阈值太高（0.7）→ 很多相关但表述不同的内容被过滤掉
→ **怎么绕**：先设 0.3，在生产环境根据实际效果微调。也可以从索引中反复抽样验证。

✅ **坑 2：System Prompt 太长压住对话空间**

大段上下文（Top-5，每块 800 字 = 4000 字）会减少留给对话的空间。
→ **怎么绕**：学习阶段 Top-3 足够；生产阶段控制在 2000 字以内。

✅ **坑 3：Web 端大文件上传不做限制**

用户传了个 50MB 的 PDF，embed 到天荒地老。
→ **怎么绕**：前端限制 5MB，后端限制单次 20 个块（超出分批处理）。

---

## 延伸阅读

| 资料 | 推荐理由 |
|------|---------|
| [Vercel AI SDK RAG 指南](https://sdk.vercel.ai/docs/guides/rag-chatbot) | 📖 官方 RAG Chatbot 教程 |
| [Upstash Vector](https://upstash.com/docs/vector/overall/getstarted) | 📖 免费 Serverless 向量数据库 |
| 本仓库 `stage-4-rag/06-rag-qa.ts` | ✅ 完整的 RAG 管道脚本 |
| 本仓库 `stage-4-rag-app/` | ✅ Next.js 14 的 RAG Web 应用 |

---

| [← 上一章：文档分块与索引建立](../chapter08/) | [下一章：Agent 基础与 Tool Calling →](../chapter10/) |
