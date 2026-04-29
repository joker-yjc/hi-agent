# Mem0 TS SDK 记忆系统架构分析

> 分析对象：`mem0ai` npm 包（TypeScript SDK，开源自托管版本）
> 源码路径：`mem0-ts/src/oss/src/`
> 分析日期：2026-04-27（已核对源码修订）

---

## 1. 项目整体架构

### 1.1 双层设计

Mem0 TS SDK 采用**双层架构**，在同一 npm 包中同时提供两种使用模式：

| 模块 | 入口 | 定位 | 核心代码 |
|------|------|------|----------|
| **MemoryClient** | `mem0ai` | 托管平台 API 客户端 | `src/client/mem0.ts` |
| **Memory (OSS)** | `mem0ai/oss` | 自托管完整记忆引擎 | `src/oss/src/memory/index.ts` |

**设计意图**：让用户根据场景选择——快速接入云服务，或在本地/私有环境获得完全控制。

### 1.2 OSS 核心模块依赖关系

```
Memory (主类)
├── Embedder (嵌入生成) ──▶ 工厂模式：OpenAI / Ollama / Azure / ...
├── LLM (大模型调用) ──▶ 工厂模式：OpenAI / Anthropic / Groq / ...
├── VectorStore (向量存储) ──▶ 工厂模式：Memory (SQLite) / Qdrant / Redis / pgvector / ...
├── HistoryManager (历史记录) ──▶ SQLite / Dummy
├── ConfigManager (配置合并)
└── prompts/ (提示词工程)
    ├── ADDITIVE_EXTRACTION_PROMPT  ← 核心：记忆提取
    └── AGENT_CONTEXT_SUFFIX
```

---

## 2. 记忆提取流程（Extraction）

### 2.1 入口：`add()` → `addToVectorStore()`

```typescript
async add(messages: string | Message[], config: AddMemoryOptions): Promise<SearchResult>
```

**关键参数**：
- `messages`：用户输入的对话内容
- `config.infer`（默认 `true`）：是否启用 LLM 智能提取（`false` 时直接逐条存储原始消息）
- `config.filters`：作用域过滤（`user_id` / `agent_id` / `run_id`，至少需要一个）

### 2.2 V3 批量管道（8 Phase）

当 `infer = true` 时，Mem0 执行一个精心设计的 8 阶段批量管道：

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Phase 0: 上下文收集                                                          │
│  ├─ 从 HistoryManager 获取最近 10 条消息（用于理解指代、上下文）                  │
│  └─ 构建 sessionScope（user_id + agent_id + run_id 的组合键）                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Phase 1: 检索已有记忆                                                        │
│  ├─ 将新消息拼接为文本，生成 query embedding                                    │
│  ├─ 语义搜索 top 10 条已有记忆                                                 │
│  └─ ⚡ 关键设计：将 UUID 映射为顺序整数（"0", "1"...），防止 LLM 幻觉生成假 ID   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Phase 2: LLM 单次提取（核心）                                                 │
│  ├─ 使用 ADDITIVE_EXTRACTION_PROMPT（~475 行的 system prompt）                │
│  ├─ 构造用户 prompt：包含 Summary / Last k Messages / Existing Memories /      │
│  │                  New Messages / Observation Date / Custom Instructions     │
│  ├─ LLM 以 json_object 模式输出                                               │
│  └─ 输出格式：`{ memory: [{id, text, attributed_to, linked_memory_ids}] }`    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Phase 3: 批量嵌入                                                            │
│  ├─ 提取所有 memory text，调用 embedder.embedBatch() 批量生成向量               │
│  └─ 回退：逐个 embed，单条失败不阻断整体流程                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Phase 4-5: CPU 处理 + 去重                                                   │
│  ├─ 计算每条记忆的 MD5 hash                                                    │
│  ├─ 与已有记忆 hash 比对，重复则跳过                                           │
│  ├─ 词形还原（lemmatizeForBm25）用于后续关键词搜索                             │
│  └─ 生成 UUID、时间戳、metadata                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  Phase 6: 批量持久化                                                          │
│  ├─ vectorStore.insert(allVectors, allIds, allPayloads) — 批量插入             │
│  └─ 回退：逐条插入，单条失败不阻断                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  Phase 7: 实体提取与关联（亮点设计）                                            │
│  ├─ 7a: 从所有记忆文本批量提取实体（extractEntitiesBatch）                     │
│  ├─ 7b: 全局去重 — 同一实体跨记忆只保留一份                                    │
│  ├─ 7c: 批量嵌入所有唯一实体文本                                               │
│  ├─ 7d: 对每个实体搜索已有实体（相似度 ≥ 0.95 则更新，否则新建）                │
│  └─ 7e: 批量插入新实体到独立实体存储（collectionName_entities）                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  Phase 8: 保存原始消息                                                        │
│  └─ db.saveMessages() — 将原始对话存入 History，用于后续上下文理解               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 提示词工程：ADDITIVE_EXTRACTION_PROMPT

这是 Mem0 记忆提取的核心竞争力，prompt 实际长度约 **475 行**（位于 `prompts/index.ts` L282-L757），设计极其精细：

**角色定义**：
```
You are a Memory Extractor — a precise, evidence-bound processor
responsible for extracting rich, contextual memories from conversations.
Your sole operation is ADD: identify every piece of memorable information
and produce self-contained, contextually rich factual statements.
```

**核心设计亮点**：

| 设计点 | 说明 |
|--------|------|
| **双角色提取** | 从 user 和 assistant 消息中同时提取（assistant 的推荐、计划、解决方案也是记忆） |
| **时间锚定** | 使用 Observation Date（对话发生日期）解析相对时间（"昨天"→具体日期），而非当前系统日期 |
| **记忆链接** | 新记忆可关联已有记忆 ID（`linked_memory_ids`），构建记忆图谱 |
| **质量标准** | 15-80 词、上下文丰富（非原子碎片）、自包含（代词替换为具体名称）、时间具体、数字精确 |
| **完整性检查** | 要求 LLM 在输出前 mentally scan 整个对话，确保没有遗漏次要话题 |
| **反幻觉规则** | 禁止编造、禁止从已有记忆中导入细节、禁止重复提取 |

**Agent 上下文后缀**（`AGENT_CONTEXT_SUFFIX`）：
当记忆绑定到 `agent_id` 时，自动追加后缀，要求 LLM 从 Agent 视角框定记忆：
```
- User-stated facts → "Agent was informed that [fact]"
- Agent actions → "Agent recommended [X]"
```

### 2.4 去重机制的三重保障

| 层级 | 机制 | 代码位置 |
|------|------|----------|
| **L1: LLM 内部去重** | 提示词强制要求：同一信息在输出中只出现一次 | `ADDITIVE_EXTRACTION_PROMPT` |
| **L2: Hash 去重** | MD5(text) 比对，完全相同文本直接跳过 | `addToVectorStore()` Phase 4-5 |
| **L3: 实体去重** | 实体相似度 ≥ 0.95 时更新而非插入 | `_linkEntitiesForMemory()` / Phase 7 |

---

## 3. 记忆召回流程（Retrieval）

### 3.1 `search()` 的 9 步流程

```typescript
async search(query: string, config: SearchMemoryOptions): Promise<SearchResult>
```

```
Step 1: 预处理查询
├─ lemmatizeForBm25(query) — 词形还原，用于关键词匹配
└─ extractEntities(query) — 提取查询中的实体，用于后续增强

Step 2: 嵌入查询
└─ embedder.embed(query) — 生成查询向量

Step 3: 语义搜索（Over-fetch）
└─ vectorStore.search(queryEmbedding, internalLimit, filters)
    其中 internalLimit = max(topK * 4, 60)
    设计意图：为后续重排序提供充足的候选池

Step 4: 关键词搜索（可选）
└─ vectorStore.keywordSearch(queryLemmatized, internalLimit, filters)
    仅当存储后端支持时启用（如 MemoryVectorStore 内建 BM25）

Step 5: BM25 分数计算
├─ getBm25Params(query) — 根据查询词数自适应选择 sigmoid 参数（**5 级阶梯**）:
│   ≤ 3 词：  [midpoint=5.0,  steepness=0.7]
│   ≤ 6 词：  [midpoint=7.0,  steepness=0.6]
│   ≤ 9 词：  [midpoint=9.0,  steepness=0.5]
│   ≤ 15 词： [midpoint=10.0, steepness=0.5]
│   > 15 词： [midpoint=12.0, steepness=0.5]
└─ normalizeBm25(rawScore, midpoint, steepness) — Sigmoid 归一化到 [0,1]

Step 6: 实体增强（Entity Boost）← 亮点设计
├─ 对查询中提取的每个实体（去重，最多 8 个）：
│   ├─ embedder.embed(entity.text)
│   ├─ entityStore.search(entityEmbedding, 500, filters) — 在实体存储中搜索
│   └─ 对匹配到的实体：
│       ├─ 获取其 linkedMemoryIds（关联的记忆 ID 列表）
│       ├─ 计算扩散衰减：memoryCountWeight = 1.0 / (1.0 + 0.001 * (numLinked - 1)^2)
│       └─ boost = similarity * ENTITY_BOOST_WEIGHT(0.5) * memoryCountWeight
└─ 将 boost 累加到对应的 memoryId

Step 7: 构建候选集
└─ 以语义搜索结果为基线候选

Step 8: 融合排序 scoreAndRank()
├─ combined = (semantic + bm25 + entityBoost) / maxPossible
├─ maxPossible 自适应：
│   仅语义: 1.0 | 语义+BM25: 2.0 | 语义+实体: 1.5 | 全部: 2.5
├─ 语义分数低于 threshold 的候选直接淘汰（门槛过滤）
└─ 按 combined 分数降序，取 topK

Step 9: 格式化输出
└─ 排除内部字段（hash, textLemmatized, user_id 等），返回干净结果
```

### 3.2 融合排序算法详解

```typescript
// src/oss/src/utils/scoring.ts
export function scoreAndRank(
  semanticResults,   // 语义搜索结果 {id, score, payload}
  bm25Scores,        // { memoryId -> normalizedBm25 }
  entityBoosts,      // { memoryId -> entityBoost }
  threshold,         // 语义分数门槛
  topK
): ScoredResult[]
```

**核心公式**：
```
combined = (semanticScore + bm25Score + entityBoost) / maxPossible
```

**设计精妙之处**：
- **自适应 maxPossible**：根据可用信号动态调整分母，确保不同配置下分数可比
- **门槛过滤**：语义分数低于 threshold 的候选即使 BM25/实体分高也被淘汰，防止纯关键词匹配污染语义结果
- **实体扩散衰减**：热门实体（关联大量记忆）的 boost 被稀释，避免少数实体垄断排序

---

## 4. 实体系统（Entity System）

### 4.1 实体提取：`extractEntities()`

**四种实体类型**（按优先级排序）：

| 类型 | 提取方式 | 示例 |
|------|----------|------|
| **PROPER** | 大写序列 + 句中位置过滤（排除句首大写） | "Osteria Francescana", "San Francisco" |
| **COMPOUND** | `compromise` NLP 库提取名词短语 | "machine learning", "aerial yoga" |
| **QUOTED** | 正则匹配引号内文本 | "The Last Dance", "Eternal Sunshine" |
| **NOUN** | 回退提取 | 单名词 |

**质量过滤链**：
1. 去重（小写文本）
2. 清理格式标记（`*`, `:`, 列表序号）
3. 过滤通用词（"thing", "stuff", "way" 等）
4. 过滤非特定形容词（"good", "new", "big" 等）
5. 选择最佳类型（PROPER > COMPOUND > QUOTED > NOUN）
6. 子串过滤（长实体包含短实体时移除短的）

### 4.2 实体存储架构

```
主记忆存储: collectionName (e.g., "mem0")
实体存储:  collectionName + "_entities" (e.g., "mem0_entities")

实体存储独立的原因：
- 实体数量远少于记忆数量
- 实体需要独立的向量空间（实体文本 vs 记忆文本语义不同）
- 实体关联跨记忆，需要全局可见
```

**实体数据结构**：
```typescript
{
  data: string,           // 实体文本（如 "Osteria Francescana"）
  entityType: string,     // PROPER / COMPOUND / QUOTED / NOUN
  linkedMemoryIds: string[],  // 关联的记忆 UUID 列表
  user_id?: string,
  agent_id?: string,
  run_id?: string,
}
```

### 4.3 实体在召回中的作用

实体增强是 Mem0 召回质量的关键差异化设计：

1. 查询中提取实体 → 嵌入 → 在实体存储中搜索
2. 找到匹配的实体 → 获取其 `linkedMemoryIds`
3. 将这些记忆 ID 在最终排序中获得 boost

**效果**：当用户搜索 "那家意大利餐厅" 时，即使语义匹配不完美，实体 "Osteria Francescana" 的关联也会将相关记忆推前。

---

## 5. 存储层设计

### 5.1 VectorStore 接口

```typescript
export interface VectorStore {
  insert(vectors, ids, payloads): Promise<void>;
  search(query, topK, filters): Promise<VectorStoreResult[]>;
  keywordSearch?(query, topK, filters): Promise<VectorStoreResult[] | null>;  // 可选
  get(vectorId): Promise<VectorStoreResult | null>;
  update(vectorId, vector, payload): Promise<void>;
  delete(vectorId): Promise<void>;
  deleteCol(): Promise<void>;
  list(filters, topK): Promise<[VectorStoreResult[], number]>;
  getUserId(): Promise<string>;
  setUserId(userId): Promise<void>;
  initialize(): Promise<void>;
}
```

### 5.2 MemoryVectorStore（默认实现）

基于 `better-sqlite3` 的内存级向量存储，适合本地开发和轻量场景：

**Schema**：
```sql
CREATE TABLE vectors (
  id TEXT PRIMARY KEY,
  vector BLOB NOT NULL,      -- Float32Array 存储为 Buffer
  payload TEXT NOT NULL      -- JSON 序列化的 metadata
);
```

**搜索实现**：全表扫描 + cosine similarity（`O(N)`，N = 向量数）

**关键词搜索**：内建 BM25 实现（完整公式，含 IDF、TF、文档长度归一化）

**过滤系统**：支持逻辑运算符（AND/OR/NOT）和比较运算符（eq/ne/gt/gte/lt/lte/in/nin/contains/icontains）

### 5.3 HistoryManager 接口

```typescript
export interface HistoryManager {
  addHistory(memoryId, previousValue, newValue, action, createdAt?, updatedAt?, isDeleted?): Promise<void>;
  getHistory(memoryId): Promise<any[]>;
  reset(): Promise<void>;
  close(): void;
  // V3 可选扩展
  saveMessages?(messages, sessionScope): Promise<void>;
  getLastMessages?(sessionScope, limit): Promise<Message[]>;
  batchAddHistory?(records): Promise<void>;
}
```

**作用**：记录记忆的变更历史（ADD/UPDATE/DELETE），支持审计和时序回溯。

---

## 6. 配置系统

### 6.1 配置合并策略

`ConfigManager.mergeConfig()` 采用**深度合并 + 自动探测**策略：

```typescript
const memory = new Memory({
  embedder: { provider: "openai", config: { apiKey: "sk-xxx", model: "text-embedding-3-small" } },
  llm: { provider: "openai", config: { apiKey: "sk-xxx", model: "gpt-4o-mini" } },
  vectorStore: { provider: "memory", config: { collectionName: "my-memories" } },
});
```

**自动探测嵌入维度**：
如果用户未显式指定 `dimension`，`Memory._autoInitialize()` 会运行一次 probe embedding（`embed("dimension probe")`），自动检测输出维度并设置到 vector store config。这让任何 embedder 都能开箱即用。

### 6.2 工厂模式

所有外部依赖（Embedder / LLM / VectorStore / HistoryManager）均通过工厂创建：

```typescript
EmbedderFactory.create(provider, config)    // → OpenAIEmbedding / OllamaEmbedding / ...
LLMFactory.create(provider, config)          // → OpenAILLM / AnthropicLLM / ...
VectorStoreFactory.create(provider, config)  // → MemoryVectorStore / QdrantVectorStore / ...
HistoryManagerFactory.create(provider, config) // → SQLiteManager / DummyHistoryManager / ...
```

**设计价值**：解耦具体实现，方便替换和扩展。

---

## 7. 关键设计亮点总结

### 7.1 提取阶段

| 亮点 | 价值 |
|------|------|
| **单次 LLM 提取** | Phase 2 只用一次 LLM 调用完成提取，而非提取→比对→决策的多轮调用，降低延迟和成本 |
| **UUID→整数映射** | 防止 LLM 在已有记忆 ID 上 hallucinate，保证关联准确性 |
| **Additive-only 提取** | V3 只做 ADD，不做 UPDATE/DELETE 决策，简化 prompt 和解析 |
| **Agent 视角后缀** | 自动根据作用域调整记忆表述，使 Agent 记忆和用户记忆语义一致 |

### 7.2 召回阶段

| 亮点 | 价值 |
|------|------|
| **Over-fetch + 重排序** | 语义搜索取 4x topK（最低 60），为融合排序提供充足候选 |
| **查询长度自适应 BM25** | 5 级阶梯选择 sigmoid 参数（≤ 3 / ≤ 6 / ≤ 9 / ≤ 15 / > 15），不同长度查询归一化更公平 |
| **实体扩散衰减** | 热门实体的 boost 被稀释，避免排序被少数高频实体垄断 |
| **自适应 maxPossible** | 融合分数根据可用信号数动态归一化，跨查询可比 |

### 7.3 实体系统

| 亮点 | 价值 |
|------|------|
| **NLP + Regex 双路径** | 安装 `compromise` 时获得高质量名词短语提取，未安装时回退到启发式规则 |
| **实体-记忆关联** | 构建轻量级知识图谱，召回时利用实体关系提升相关性 |
| **独立实体存储** | 实体和记忆分离存储，各自维护最优向量空间 |

### 7.4 工程健壮性

| 亮点 | 价值 |
|------|------|
| **全链路回退** | 批量操作失败 → 逐条操作；embedBatch 失败 → 逐条 embed |
| **非致命错误处理** | 实体链接、历史记录等辅助操作出错时只打日志，不阻断主流程 |
| **初始化重试** | `_ensureInitialized()` 在首次初始化失败后自动重试 |
| **schema 校验** | Zod 验证配置，提前发现错误 |

---

## 8. 源码文件索引

| 文件 | 职责 |
|------|------|
| `oss/src/memory/index.ts` | **核心**：Memory 类，`add()` / `search()` / `update()` / `delete()` |
| `oss/src/prompts/index.ts` | **核心**：`ADDITIVE_EXTRACTION_PROMPT`、提示词构建器、Zod Schema |
| `oss/src/utils/scoring.ts` | **核心**：BM25 归一化、多信号融合排序 `scoreAndRank()` |
| `oss/src/utils/entity_extraction.ts` | **核心**：实体提取（PROPER/COMPOUND/QUOTED/NOUN）|
| `oss/src/vector_stores/base.ts` | 向量存储抽象接口 |
| `oss/src/vector_stores/memory.ts` | 默认 SQLite 向量存储实现（含 BM25）|
| `oss/src/storage/base.ts` | 历史管理抽象接口 |
| `oss/src/config/manager.ts` | 配置合并与默认值处理 |
| `oss/src/types/index.ts` | 类型定义和 Zod Schema |
| `client/mem0.ts` | 托管平台 HTTP 客户端 |

---

## 9. 对你项目的借鉴建议

如果你要在 `stage-5-agent` 中实现类似的记忆系统，建议的**最小可行实现（MVP）**路径：

### MVP 阶段 1：基础语义记忆
1. **存储**：SQLite + better-sqlite3（参考 `MemoryVectorStore`），全表扫描 cosine 相似度
2. **提取**：简化的 LLM prompt（提取事实列表），`json_object` 输出模式
3. **召回**：纯语义搜索（cosine similarity），无 BM25 和实体增强
4. **作用域**：用 `user_id` / `agent_id` / `run_id` 做简单过滤

### MVP 阶段 2：加入关键词增强
1. 在 payload 中存储 `textLemmatized`
2. 实现简单的 BM25 内联计算（参考 `MemoryVectorStore.keywordSearch()`）
3. 召回时语义 + BM25 融合排序

### MVP 阶段 3：实体增强
1. 实现简化的实体提取（先用正则提取大写词和引号文本）
2. 创建独立的实体表/集合
3. 召回时加入实体 boost（参考 `scoreAndRank()` 的 entityBoost 逻辑）

### 关键可复用代码模式
- **UUID→整数映射**：防止 LLM 幻觉（`uuidMapping[String(idx)] = mem.id`）
- **自适应 sigmoid 归一化**：`getBm25Params()` 根据查询长度选参数
- **扩散衰减**：`1.0 / (1.0 + 0.001 * (numLinked - 1)^2)`
- **全链路回退**：批量失败 → 逐条，辅助操作失败 → 日志而非抛错
