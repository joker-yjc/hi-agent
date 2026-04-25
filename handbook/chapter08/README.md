# 第 8 章：文档分块与索引建立

> 本章目标：学会如何把长文档拆成小块、生成 Embedding、建立可搜索的索引。
> 对应学习计划：Day 11

---

## 概念速览

### 为什么要分块（Chunking）？

LLM 的上下文窗口有限，不能一次塞整本书。需要把长文档拆成小块：

```
[长文档 5000 字]
    ↓ 分块
[块 1: 800字] [块 2: 800字] [块 3: 800字] ...
    ↓ Embedding
[向量 1]      [向量 2]      [向量 3]      ...
```

### 两个关键参数

| 参数 | 作用 | 推荐值 |
|------|------|--------|
| **Chunk Size** | 每块的大小（字符数） | 500-1000 字符 |
| **Overlap** | 相邻块之间重叠的字符数 | 100-200 字符 |

### 为什么需要 Overlap

```
块 1："React 的 Fiber 架构是为了解决渲染阻塞问题。
       Fiber 将渲染工作分成多个小任务..."

块 2："...Fiber 将渲染工作分成多个小任务，可以随时暂停。
       这让 React 能优先处理高优先级的更新..."
```

如果 `"可以随时暂停"` 这一句被块边界切断，没有 Overlap 的话就会丢失上下文。Overlap 保证了"跨块的连络性"。

---

## 一句话总结

分块是在"保留完整上下文"和"提高检索精度"之间的权衡。Overlap 保证跨块连续性，`embedMany` 避免 API 调用失控，索引的本质是"内容 → 向量 → 可搜索结构"的映射表。

---

## 技术选型

### 分块策略

| 策略 | 实现 | 适用场景 |
|------|------|---------|
| **按段落分**（推荐） | 检测 `\n\n` 切分 | Markdown、文章 |
| **按固定字符数** | 简单计数器 | 纯文本、日志 |
| **按句子分** | 检测 `.?!` 结束符 | 技术文档、论文 |
| **语义分块** | 用 LLM 判断分界点 | 成本高，慎重 |

✅ **推荐**：学习阶段用"按段落分"（最简单有效），生产阶段可以结合固定字符数做滑动窗口。

### 完整索引流程

```
读文件 → 提取文本 → 分块 → 生成 Embedding → 存为 JSON
```

```typescript
// 最终的索引文件（index.json）
[
  { chunkId: 0, content: "块内容...", embedding: [0.023, -0.451, ...], source: "react-hooks.md" },
  { chunkId: 1, content: "块内容...", embedding: [-0.891, 0.234, ...], source: "react-hooks.md" },
  ...
]
```

---

## 代码骨架

### 1. 按段落分块（生产级实现）

```typescript
// stage-4-rag/03-chunking.ts
function chunkByParagraph(
  text: string,
  maxChunkSize: number = 800,
  overlap: number = 150
): string[] {
  const paragraphs = text.split(/\n\n+/)
  const chunks: string[] = []
  let current = ''

  for (const para of paragraphs) {
    if (current.length + para.length > maxChunkSize && current.length > 0) {
      chunks.push(current.trim())
      // Overlap：当前段落加到下一块的开头
      current = current.slice(-overlap) + '\n\n' + para
    } else {
      current = current ? current + '\n\n' + para : para
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks
}
```

### 2. 完整的索引建立

```typescript
// stage-4-rag/04-indexing.ts
import { readFileSync } from 'fs'
import { embedMany } from 'ai'
import { openai } from 'shared-utils'

// 1. 读文件
const doc = readFileSync('docs/react-hooks.md', 'utf-8')

// 2. 分块
const chunks = chunkByParagraph(doc, 800, 150)
console.log(`分了 ${chunks.length} 个块`)

// 3. 批量生成 Embedding（一次 API 调用）
const { embeddings } = await embedMany({
  model: openai.embedding('text-embedding-v2'),
  values: chunks,
})

// 4. 组装索引
const index = chunks.map((content, i) => ({
  chunkId: i,
  content,
  embedding: embeddings[i],
  source: 'react-hooks.md',
}))

// 5. 持久化
writeFileSync('index.json', JSON.stringify(index, null, 2))
```

### 3. 从索引中搜索

```typescript
// stage-4-rag/05-search.ts
function search(query: string, index: ChunkIndex[], topK: number = 3) {
  const queryEmbedding = await embed({ model, value: query })

  // 计算相似度 + 排序
  const scored = index.map(chunk => ({
    ...chunk,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }))

  scored.sort((a, b) => b.score - a.score)

  // 过滤低分结果
  return scored.slice(0, topK).filter(c => c.score > 0.3)
}
```

---

## 实战建议（Day 11 任务指南）

1. **准备测试文档**（10 分钟）
   - 在 `docs/` 目录放 3-5 个 Markdown 文件
   - 建议用你熟悉的前端知识文档（如 React Hooks 说明）

2. **写 03-chunking.ts**（15 分钟）
   - 实现上面的 `chunkByParagraph` 函数
   - 测试：分块后打印每个块的前 50 字，确认分界合理

3. **写 04-indexing.ts**（15 分钟）
   - 串联整个流程：读文档 → 分块 → Embedding → 存为 JSON
   - 用 `embedMany` 批量生成（不要逐块调用 API，太慢也太贵）

---

## 练习

### 基础练习

1. 实现 `chunkByParagraph` 函数，用一篇 2000 字的技术文章测试，观察不同 `maxChunkSize`（500/800/1500）产生的块数量和边界位置
2. 对比有 Overlap（150 字符）和无 Overlap 的分块结果，找一句恰好跨边界的话，验证 Overlap 是否保留了上下文
3. 用 `embedMany` 为一组分块生成 Embedding，将结果存入 `index.json`，再写一个 `loadIndex()` 函数读取它

### 进阶挑战

1. 实现"按固定字符数 + 滑动窗口"的分块策略，与按段落分块对比：哪种在搜索"某个具体 API 的用法"时更准确？
2. 为索引添加元数据字段（如 `category`、`tags`），实现"先按标签过滤，再向量搜索"的两阶段检索

### 思考题

1. 为什么代码文档（如 API 文档）适合按段落分，而小说可能不适合？
2. Chunk Size 太小会导致什么问题？太大会导致什么问题？如何根据文档类型动态选择？

---

## 踩坑记录

✅ **坑 1：Chunk Size 过大导致检索精度低**
块太大（如 2000 字符），搜出来的结果里有效信息"被稀释"。
→ **怎么绕**：500-800 字符是性价比最高的区间。

✅ **坑 2：没有 Overlap 会导致跨块信息断裂**
一句话刚好跨块边界，两个块都不完整。
→ **怎么绕**：Overlap 设为 Chunk Size 的 15-20%。

✅ **坑 3：用 `embed()` 逐块调用 API 既慢又贵**
5 个块就是 5 次 API 调用。
→ **怎么绕**：始终用 `embedMany()` 一次调用处理所有块。

---

## 延伸阅读

| 资料 | 推荐理由 |
|------|---------|
| [LangChain Text Splitters](https://js.langchain.com/docs/concepts/text_splitters) | 📖 分块策略参考（概念通用，不一定要用 LangChain） |
| 本仓库 `stage-4-rag/03-chunking.ts` | ✅ 完整的分块实现 |
| 本仓库 `stage-4-rag/04-indexing.ts` | ✅ 完整的索引建立流程 |

---

| [← 上一章：Embedding 与向量基础](../chapter07/) | [下一章：RAG 完整管道 →](../chapter09/) |
