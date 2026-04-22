# Day 11 知识点总结：文档分块 + 向量存储

> 阶段：阶段四 - RAG 检索增强生成实战

---

## 核心概念

- **Chunk Size**：每个块的大小（500-1000 字符推荐）
- **Overlap**：相邻块的重叠部分（100-200 字符），保证上下文连贯
- **向量存储方案**：内存/Upstash Vector/PostgreSQL + pgvector

## 分块策略对比

| 方案 | 优点 | 缺点 |
|------|------|------|
| 内存存储 | 零依赖，最快上手 | 重启丢失 |
| Upstash Vector | 免费额度，Serverless | 需注册 |
| PostgreSQL + pgvector | 生产级 | 需安装 PG |

## 关键代码模式

```typescript
// 简单分块
function chunkText(text: string, size: number, overlap: number): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    chunks.push(text.slice(start, start + size));
    start += size - overlap;
  }
  
  return chunks;
}
```

## 完整索引流程

```
读取文档 → 分块 → 生成 Embedding → 存入内存数组 → 序列化到 JSON
```

## 实践要点

- Chunk Size 太小 → 丢失上下文；太大 → 检索不精确
- Overlap 保证相邻块之间有上下文衔接
- JSON 文件存储适合学习 demo，生产环境用向量数据库

## 常见误区

❌ 不做 Overlap 直接切分  
✅ Overlap 能避免关键信息被切在边界上丢失

## 一句话总结

> 分块 = 把长文档切成小片，Overlap 保证上下文不丢失。

## 关联知识点

- **前置**：[Day 10（RAG + Embedding 基础）](Day10-RAG与Embedding基础.md)
- **后置**：[Day 12（RAG 检索 + 问答）](Day12-RAG检索与问答.md)
