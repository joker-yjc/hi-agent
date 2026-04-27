# 第 7 章：Embedding 与向量基础

> 本章目标：理解 Embedding 的本质——如何把文字变成数字，以及如何用这些数字衡量"语义相似度"。
> 对应学习计划：Day 10

---

## 概念速览

### Embedding — 文字的"数字化指纹"

Embedding 是给一段文本生成一个高维向量（通常 1024-3072 维）。语义相近的文本，向量之间"方向接近"。

```
"我喜欢编程"  → [0.023, -0.451, 0.892, ..., 0.134]  (1536 维向量)
"我爱写代码"  → [0.018, -0.442, 0.901, ..., 0.128]  (向量方向相近)
"今天下雨了"  → [-0.891, 0.234, -0.056, ..., 0.762]  (向量方向差异大)
```

### 余弦相似度 — 两个向量的"方向一致性"

这是最常用的向量相似度计算方式：

```
余弦相似度 = (A · B) / (|A| × |B|)

- 接近 1：方向相同，语义相似
- 接近 0：方向正交，无关
- 接近 -1：方向相反，语义对立
```

### RAG（Retrieval-Augmented Generation）— 给 LLM 装个"小抄"

```
文档 → 分块 → Embedding → 存入向量库
                              ↓
用户提问 → 问题 Embedding → 向量搜索 → 取出相关块
                              ↓
相关块 + 用户问题 → 拼入 System Prompt → LLM 生成回答
```

✅ **关键认知**：RAG 不是让模型更聪明，是给模型提供"参考资料"让它基于事实回答。

---

## 一句话总结

Embedding 将文字映射到高维空间中的方向，语义相近则方向接近，余弦相似度衡量这种"方向一致性"。RAG 的本质不是让 LLM 变聪明，而是给它发一张"开卷考试允许带的小抄"。

---

## 技术选型

### Embedding 模型对比（前端 TypeScript 生态）

| 模型 | 提供商 | 向量维度 | 费用 | 接入方式 |
|------|--------|---------|------|---------|
| text-embedding-3-small | OpenAI | 1536 | ~$0.02/1M tokens | `@ai-sdk/openai` |
| text-embedding-v2 | 阿里云 | 1536 | ¥0.0007/千 tokens | `@ai-sdk/openai` 兼容模式 |
| text-embedding-v3 | 阿里云 | 1024 | ¥0.0007/千 tokens | `@ai-sdk/openai` 兼容模式 |

⚠️ **关键限制**：`@ai-sdk/alibaba` 目前**不支持 Embedding**，需要通过 `@ai-sdk/openai` 的兼容模式接入阿里云的 Embedding API。

### 向量存储方案

| 方案 | 优点 | 缺点 | 推荐阶段 |
|------|------|------|---------|
| **内存数组 + JSON 文件** | 零依赖，5 分钟上手 | 数据大时慢，重启丢失 | 学习阶段 |
| Upstash Vector | 免费额度，Serverless | 需要注册账号 | 个人项目 |
| pgvector (PostgreSQL) | 生产级，功能全 | 需要装数据库 | 生产部署 |

✅ **学习阶段**：先用"内存数组 + JSON 文件"方案，理解流程后再说。

---

## 代码骨架

### 1. 生成 Embedding（最小示例）

```typescript
// stage-4-rag/01-embedding.ts
import { embed } from 'ai'
import { openai } from 'shared-utils'

const { embedding } = await embed({
  model: openai.embedding('text-embedding-v2'),
  value: '前端开发是构建用户界面的过程',
})

console.log(embedding.length) // 1536 (向量维度)
console.log(embedding.slice(0, 5)) // [0.023, -0.451, ...] (前 5 个值)
```

### 2. 计算余弦相似度

```typescript
// stage-4-rag/02-similarity.ts
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

const { embedding: vec1 } = await embed({ model, value: 'React 是一个前端框架' })
const { embedding: vec2 } = await embed({ model, value: 'Vue 也是前端框架' })
const { embedding: vec3 } = await embed({ model, value: '今天天气很好' })

console.log(cosineSimilarity(vec1, vec2)) // ~0.85 (语义相似)
console.log(cosineSimilarity(vec1, vec3)) // ~0.12 (语义无关)
```

### 3. 批量生成 Embedding（用 `embedMany` 节省 API 调用）

```typescript
// stage-4-rag/04-indexing.ts
import { embedMany } from 'ai'

const { embeddings } = await embedMany({
  model: openai.embedding('text-embedding-v2'),
  values: ['分块 1 的内容...', '分块 2 的内容...', '分块 3 的内容...'],
})
// embeddings 是三个向量的数组，一次 API 调用完成
```

---

## 实战建议（Day 10 任务指南）

1. **理解概念**（15 分钟）
   - 读 RAG 流程的介绍（Pinecone 的 RAG 入门指南）
   - 搞清楚"为什么 Embedding 能表示语义"

2. **写 01-embedding.ts**（10 分钟）
   - 给一段文本生成 Embedding
   - 打印向量维度（理解"1536 维"是什么样的）
   - 打印前几个数值，直观感受

3. **写 02-similarity.ts**（15 分钟）
   - 实现余弦相似度函数（照着上面的骨架，也可以直接用 `ai` 包的 `cosineSimilarity`）
   - 测试"语义相近"和"语义无关"两对文本
   - 观察数值差异，验证 Embedding 确实能反映语义

---

## 踩坑记录

✅ **坑 1：`@ai-sdk/alibaba` 不支持 Embedding**

```typescript
// ❌ 不会报错但根本没有 embedding 功能
import alibaba from '@ai-sdk/alibaba'
const m = alibaba('qwen3-max')
embed({ model: m, value: '...' }) // 不工作！

// ✅ 正确：走 @ai-sdk/openai 兼容模式
import { createOpenAI } from '@ai-sdk/openai'
const alibabaCompat = createOpenAI({
  apiKey: process.env.ALIBABA_API_KEY,
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
})
const { embedding } = await embed({
  model: alibabaCompat.embedding('text-embedding-v2'),
  value: '...',
})
```

→ 已在 `shared-utils/openai.ts` 中统一封装。

✅ **坑 2：阿里云 Embedding 模型命名**
- 叫 `text-embedding-v2`（不是 `text-embedding-ada-002`）
- v2 是 1536 维，v3 是 1024 维
- 用的 API 格式和 OpenAI 完全兼容

---

## 练习

### 基础练习

1. 写一段 50 字的自我介绍，用 `embed()` 生成 Embedding，打印向量维度和前 10 个值
2. 准备三句话：两句语义相近、一句语义无关，计算它们两两之间的余弦相似度，验证结果是否符合直觉
3. 修改余弦相似度阈值（0.1 / 0.3 / 0.5 / 0.7），观察同一批查询结果的变化，理解"阈值就是精度与召回的权衡"

### 进阶挑战

1. 实现一个简单的"语义搜索"：给 10 个前端知识点生成 Embedding，存入数组，然后输入问题返回 Top-3 最相关的知识点
2. 对比 `embed()` 逐块调用和 `embedMany()` 批量调用的 API 耗时和费用差异（阿里云按千 tokens 计费）

### 思考题

1. 为什么 Embedding 模型通常比对话模型小很多？它的训练目标和对话模型有什么不同？
2. 余弦相似度只比较"方向"不比较"长度"，这对语义搜索是优点还是缺点？什么场景下需要欧氏距离？

---

## 延伸阅读

| 资料 | 推荐理由 |
|------|---------|
| [Pinecone RAG 入门](https://www.pinecone.io/learn/retrieval-augmented-generation/) | 📖 RAG 概念讲解的标杆文章 |
| [What are Embeddings (Vicki Boykis)](https://vickiboykis.com/what_are_embeddings/) | 📖 嵌入向量的经典入门 |
| [AI SDK Embeddings 文档](https://sdk.vercel.ai/docs/ai-sdk-core/embeddings) | 📖 `embed`/`embedMany` API 参考 |
| 本仓库 `stage-4-rag/` | ✅ 6 个可运行脚本，从 Embedding 到完整 RAG 管道 |

---

| [← 上一章：多模型切换与对话历史](../chapter06/README.md) | [下一章：文档分块与索引建立 →](../chapter08/README.md) |
