# Day 10 知识点总结：RAG + Embedding 基础

> 阶段：阶段四 - RAG 检索增强生成实战

---

## 核心概念

- **RAG**：检索增强生成，让 LLM 基于私有知识库回答
- **Embedding**：文本→向量的映射，语义相似的文本向量距离近
- **余弦相似度**：衡量两个向量方向的相似程度

## RAG 完整流程

```
文档 → 分块 → Embedding → 存入向量库
                              ↓
用户提问 → 问题 Embedding → 向量搜索 → 取出相关块 → 拼入 Prompt → LLM 生成
```

## 关键代码模式

### 生成 Embedding

```typescript
import { embed } from 'ai';

const { embedding } = await embed({
  model: openai.embedding('text-embedding-3-small'),
  value: '这是一段文本',
});

// embedding 是一个高维向量（如 1536 维）
```

### 余弦相似度计算

```typescript
function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const normB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  return dotProduct / (normA * normB);
}
```

## 实践要点

- Embedding 向量维度因模型而异（如 text-embedding-3-small 是 1536 维）
- 余弦相似度范围 [-1, 1]，实际文本相似度通常在 [0, 1]
- 语义相近的文本（如"猫"和"小猫"）相似度 > 0.8

## 常见误区

❌ 认为 Embedding 是"关键词匹配"  
✅ Embedding 是语义匹配，即使词不同，意思相近也会高相似度

## 一句话总结

> RAG = 把知识库变成向量，问问题时找到最相关的片段喂给 LLM。

## 关联知识点

- **前置**：[Day 9（对话历史持久化）](../../阶段三-构建AI_Chat_Web应用/Day09-对话历史持久化.md)
- **后置**：[Day 11（文档分块 + 向量存储）](Day11-文档分块与向量存储.md)
