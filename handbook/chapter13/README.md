# 第 13 章：Agent 记忆系统（长期记忆）

> 本章目标：掌握跨会话的长期记忆存储——向量记忆、知识图谱记忆的存储和检索。
> 对应学习计划：Day 17-18
> 状态：🚧 部分内容待补充

---

## 概念速览

### 长期记忆 vs 短期记忆

|  | 短期记忆（第 12 章） | 长期记忆（本章） |
|------|-------------------|-----------------|
| 范围 | 单次对话内 | 跨会话、跨项目 |
| 存储 | 内存中的数组 | 本地文件 / SQLite / 向量库 |
| 检索方式 | 按顺序取（截断/窗口） | 语义搜索（Embedding 相似度） |
| 典型问题 | "刚才聊了什么？" | "两个月前我学过什么技术？" |

### 两种长期记忆方案

**方案 A：向量记忆（Vector Memory）**
```
记忆内容 → Embedding → 存入向量库
新问题 → Embedding → 相似度搜索 → 返回相关记忆
```
适合：自由文本记忆、知识点、对话历史

**方案 B：知识图谱记忆（Entity Memory）**
```
实体：{ name, type, observations[] }
关系：{ from → relationType → to }
```
适合：用户画像、实体之间的关系、结构化知识

---

## 一句话总结

长期记忆让 Agent 跨会话"记得"用户。向量记忆适合语义检索非结构化内容，知识图谱适合结构化实体关系。学习阶段用 JSON 文件持久化，生产环境再升级数据库。

---

## 技术选型

### 学习阶段推荐方案

| 层次 | 方案 | 用途 |
|------|------|------|
| **轻量级** | JSON 文件 | 少量记忆的持久化，适合 Day 17 学习 |
| **中等** | SQLite + USearch | 本地向量搜索 + 结构化存储（参考 OpenCode） |
| **生产级** | pgvector / Upstash Vector | 云端向量数据库 |

---

## 代码骨架

### 1. 向量记忆（JSON + Embedding）

```typescript
// stage-5-agent/09-persistent-memory.ts
interface Memory {
  id: string
  content: string
  embedding: number[]
  createdAt: number
  importance: number // 1-5，重要记忆保留更久
}

// 添加记忆
async function addMemory(content: string) {
  const { embedding } = await embed({
    model: openai.embedding('text-embedding-v2'),
    value: content,
  })
  memories.push({
    id: Date.now().toString(),
    content,
    embedding,
    createdAt: Date.now(),
    importance: 3,
  })
  saveToFile(memories, 'memories.json')
}

// 语义搜索记忆
async function searchMemories(query: string, topK: number = 3) {
  const { embedding } = await embed({ model, value: query })
  return memories
    .map(m => ({ ...m, score: cosineSimilarity(embedding, m.embedding) }))
    .sort((a, b) => b.score - a.score)
    .filter(m => m.score > 0.4)
    .slice(0, topK)
}

// 注入到后续对话
const relevantMemories = await searchMemories(userInput, 3)
const context = relevantMemories.map(m => `- ${m.content}`).join('\n')
```

### 2. 知识图谱记忆（Entity-Relation 模式）

```typescript
// stage-5-agent/10-entity-memory.ts
interface Entity {
  name: string      // 实体名称
  type: string      // 实体类型
  observations: string[] // 观察/属性列表
}

interface Relation {
  from: string      // 主体
  to: string        // 客体
  type: string      // 关系类型
}

// 示例数据库
const entities: Entity[] = [
  { name: '用户', type: 'person', observations: ['前端开发者', '偏好 TypeScript'] },
  { name: 'React', type: 'technology', observations: ['前端框架', '使用 JSX'] },
]
const relations: Relation[] = [
  { from: '用户', to: 'React', type: 'has_skill' },
]

// 从对话中自动提取实体和关系
async function extractEntities(text: string) {
  const result = await generateText({
    model: qwen('qwen3-max'),
    output: Output.object({
      schema: z.object({
        entities: z.array(z.object({ name: z.string(), type: z.string(), observations: z.array(z.string()) })),
        relations: z.array(z.object({ from: z.string(), to: z.string(), type: z.string() })),
      }),
    }),
    prompt: `从以下对话中提取实体和它们的属性、关系：\n${text}`,
  })
  return result.output
}
```

---

## 练习

### 基础练习

1. 实现 `08-vector-memory.ts`：定义 `addMemory` 和 `searchMemories` 函数，用 JSON 文件持久化记忆，测试"添加记忆 → 关闭程序 → 重启 → 搜索记忆"的完整流程
2. 实现记忆去重：添加新记忆前，先搜索已有记忆，如果相似度 > 0.9 则更新而非新增
3. 实现 `10-entity-memory.ts`：用 LLM 从一段对话文本中提取实体和关系，存入 `entities.json` 和 `relations.json`

### 进阶挑战

1. 为向量记忆添加"重要性评分"（1-5），低重要性记忆在存储超过 50 条后被自动清理
2. 实现"记忆注入"：每次对话开始时，基于用户输入搜索相关记忆，将其拼入 System Prompt

### 思考题

1. 向量记忆和知识图谱记忆各适合什么场景？能否设计一个"混合记忆"系统，同时利用两者的优势？
2. 长期记忆的"隐私边界"在哪里？如果 Agent 记住了用户的敏感信息，如何设计"遗忘机制"？

---

## 实战建议（Day 17-18 任务指南）

### Day 17：向量长期记忆
1. 写 `08-vector-memory.ts`：
   - 用 Embedding + JSON 文件实现记忆存储
   - 新对话开始时，基于用户输入检索相关记忆
   - 将检索到的记忆注入 System Prompt
2. 写 `09-persistent-memory.ts`：
   - 实现跨会话持久化（JSON 文件读/写）
   - 实现记忆去重（相似内容不重复存储）
   - 测试：关闭程序→重启→Agent 仍能回忆之前的内容

### Day 18：知识图谱 + Web 界面
1. 写 `10-entity-memory.ts`：
   - 实现 Entity + Relation 数据模型
   - 用 LLM 从对话中自动提取实体
   - 查询时检索相关实体的所有观察
2. 创建 Web 界面：
   - 在 `stage-5-agent-app` 中实现 Agent 思考过程可视化
   - 展示工具调用、参数、结果

---

## 延伸阅读

| 资料 | 推荐理由 |
|------|---------|
| [mem0 文档](https://docs.mem0.ai/overview) | 📖 主流 Agent 记忆层框架 |
| [OpenCode Memory 实现](https://github.com/nicepkg/opencode) | 📖 SQLite + USearch 向量记忆的参考实现 |
| [MCP Memory Server](https://github.com/modelcontextprotocol/servers/tree/main/src/memory) | 📖 知识图谱记忆的参考实现 |

---

| [← 上一章：Agent 记忆系统（短期记忆）](../chapter12/) | [下一章：Agent 框架对比与 Skill 设计 →](../chapter14/) |
