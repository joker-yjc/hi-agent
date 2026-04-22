# Day 12 知识点总结：RAG 检索 + 问答

> 阶段：阶段四 - RAG 检索增强生成实战

---

## 核心概念

- **向量搜索**：计算问题与所有文档块的相似度，返回 Top-K
- **上下文注入**：将检索到的文档块拼入 System Prompt
- **引用来源**：标注回答来自哪个文档的哪个块

## 关键代码模式

### 向量搜索

```typescript
function search(queryEmbedding: number[], index: ChunkIndex[], topK: number = 3) {
  return index
    .map(chunk => ({
      ...chunk,
      similarity: cosineSimilarity(queryEmbedding, chunk.embedding),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}
```

### RAG 问答完整链路

```typescript
async function ragQa(question: string) {
  // 1. 问题向量化
  const { embedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: question,
  });
  
  // 2. 向量搜索
  const relevantChunks = search(embedding, index, 3);
  
  // 3. 构建上下文
  const context = relevantChunks.map(c => c.content).join('\n\n');
  
  // 4. 调用 LLM
  const result = await generateText({
    model: openai('gpt-4o-mini'),
    system: `基于以下知识库内容回答问题：\n\n${context}`,
    prompt: question,
  });
  
  return {
    answer: result.text,
    sources: relevantChunks.map(c => c.source),
  };
}
```

## 实践要点

- Top-K 通常取 3-5，太少信息不足，太多引入噪声
- 上下文注入时可以用 `---` 分隔不同文档块
- 标注引用来源增加回答可信度

## 测试要点

- 问知识库中有的内容 → 应该能准确回答并引用
- 问知识库中没有的内容 → 应该表示"没有找到相关信息"

## 一句话总结

> RAG 问答 = 向量搜索找相关内容 → 拼入 Prompt → LLM 基于上下文回答。

## 关联知识点

- **前置**：[Day 11（文档分块 + 向量存储）](Day11-文档分块与向量存储.md)
- **后置**：[Day 13（RAG Web 界面）](Day13-RAGWeb界面.md)
