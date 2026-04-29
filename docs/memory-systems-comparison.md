# Mem0 vs Mastra vs OpenCode 记忆系统对比总结

> 分析日期：2026-04-28（已根据源码核对修订）
> 分析对象：Mem0 TS SDK（mem0ai/mem0）vs Mastra Memory（mastra-ai/mastra）vs OpenCode Session Memory（anomalyco/opencode）

---

## 1. 一句话定位

| 项目 | 定位 |
|------|------|
| **Mem0** | **通用记忆层** — 可接入任何 Agent 框架，托管 + 自托管双模式 |
| **Mastra** | **Agent 框架内置记忆** — 深度集成到 Mastra Agent，四层互补架构 |
| **OpenCode** | **工程型会话压缩记忆** — 面向长编码会话的上下文压缩与续跑 |

---

## 2. 架构对比

### 2.1 整体架构

```
Mem0（两层）
├── MemoryClient（托管 API 客户端）
└── Memory（自托管引擎）
    ├── Embedder（嵌入生成）
    ├── LLM（提取调用）
    ├── VectorStore（向量存储）
    ├── HistoryManager（历史记录）
    └── Entity System（实体存储与关联）

Mastra（四层 + 三 Agent）
├── Conversation History（消息持久化）
├── Working Memory（结构化事实/偏好）
├── Semantic Recall（向量语义搜索）
└── Observational Memory（核心亮点）
    ├── Actor（主 Agent）
    ├── Observer（观察提取 Agent）
    └── Reflector（压缩重组 Agent）

OpenCode（会话压缩）
├── SessionStore（SQLite: session/message/part）
├── Compaction Trigger（手动 summarize / 自动 overflow）
├── Compaction Engine（生成结构化摘要）
└── Context Reinjection（summary + tail 回注模型）
```

### 2.2 核心差异表

| 维度 | Mem0 | Mastra | OpenCode |
|------|------|-------|----------|
| **提取方式** | 单次 LLM 调用（8 Phase 批量管道） | Observer Agent 持续后台运行 | 上下文过长时触发 AI compaction |
| **提取架构** | 单 LLM（Extractor role） | 三 Agent（Actor + Observer + Reflector）| 单会话压缩链路 |
| **工作记忆** | ❌ 无此概念 | ✅ Markdown/JSON Schema 双模式 | ❌ 无独立 Working Memory |
| **观察记忆** | ❌ 无此概念 | ✅ 核心亮点，压缩级别 0-4 | ❌ 无观察记忆层 |
| **实体系统** | ✅ 有（4 类实体 + 关联记忆） | ❌ 无独立实体系统 | ❌ 无实体系统 |
| **时间处理** | Observation Date 锚定（相对→绝对） | 系统提示词内置时间锚定 + temporal markers | 依赖当前会话时间线，不做长期时间归档 |
| **召回方式** | 语义 + BM25 + 实体 boost | 观察上下文 + Working Memory + 未观察消息 | summary + tail 回注 |
| **作用域** | user_id / agent_id / run_id | thread / resource 双模式 | session |
| **存储后端** | VectorStore 工厂 + 独立实体存储 | MemoryStorage 多后端（LibSQL/PG/Mongo/Cloudflare）| SQLite + Drizzle |
| **模型路由** | ❌ 无 | ✅ ModelByInputTokens（按输入 token 数选模型）| ❌ 无独立记忆模型路由 |

---

## 3. 记忆提取对比

### 3.1 Mem0：Additive Extraction（单次调用，批量管道）

**核心 Prompt**：`ADDITIVE_EXTRACTION_PROMPT`（~700 行）

```
提取流程（8 Phase）：
Phase 0: 上下文收集（最近 10 条消息）
Phase 1: 语义搜索已有记忆（UUID→整数映射防幻觉）
Phase 2: LLM 单次提取（Extractor role，区分 user/assistant）
Phase 3: 批量嵌入（embedBatch，回退到逐条）
Phase 4-5: CPU 去重（MD5 hash + 词形还原）
Phase 6: 批量持久化（vectorStore.insert）
Phase 7: 实体提取与关联（全局去重 + 相似度 ≥0.95 更新）
Phase 8: 保存原始消息
```

**提取特点**：
- **单次 LLM 调用**：提取 → 比对 → 决策 全部在一次调用完成
- **Extractor role**："You are a Memory Extractor — a precise, evidence-bound processor"
- **Agent 视角后缀**：`AGENT_CONTEXT_SUFFIX`（Agent 陈述框定为 "Agent was informed that..."）
- **反幻觉规则**：禁止编造、禁止从已有记忆导入细节、禁止重复提取

### 3.2 Mastra：Observer + Reflector（双 Agent 持续压缩）

**Observer Agent Prompt**：`OBSERVER_EXTRACTION_INSTRUCTIONS`

```
Observer 提取（消息达到阈值时触发）：
- 区分用户断言（User stated）vs 问题（User asked）
- 时间锚定：(HH:MM) 观察内容。（meaning DATE）
- Emoji 优先级标记：🔴 High（用户事实/偏好/目标）、🟡 Medium（项目细节/工具结果）、🟢 Low（次要/不确定）、✅ Completed（完成标记）
- 状态变化显式化："User will start X (changing from Y)"
- 保留用户原话中的特殊术语（"movement session" → 原样记录）

Reflector Agent Prompt：buildReflectorSystemPrompt()

Reflector 压缩（观察结果过长时触发）：
- 重组和精简观察结果
- 绘制观察之间的连接和结论
- 识别 Agent 是否偏离主题
- 多级压缩（默认起始级别：Gemini 2.5 Flash → 2，其他 → 1；最高 4）
- XML 结构化输出：`<observations>`、`<current-task>`、`<suggested-response>`
```

**提取特点**：
- **三 Agent 架构**：Actor 看到观察结果 + 未观察消息，Observer 后台提取，Reflector 压缩重组
- **Observer 持续运行**：消息达到 `messageTokens` 阈值时自动触发
- **Reflector 多级压缩**：根据观察结果长度自动选择压缩级别（0-4）
- **时间锚定**：系统提示词内置，将"yesterday" → "2026-04-26" 等相对时间转为绝对日期
- **异步缓冲**：Observer 可在后台运行（`bufferTokens` 配置，默认是比例 0.2），不阻塞主 Agent 响应
- **Emoji 是优先级标记**（非角色标记）：🔴 High、🟡 Medium、🟢 Low、✅ Completed

### 3.3 OpenCode：Compaction（会话压缩提取）

**核心入口**：`SessionCompaction.create()` + `SessionCompaction.process()`

```text
提取流程：
1. 检测上下文超长或手动调用 /session/:id/summarize
2. 创建一条 compaction user message
3. 选择 head + recent tail
4. 用固定 SUMMARY_TEMPLATE 让模型输出结构化摘要
5. 生成一条 summary=true 的 assistant message
6. 后续对话中用摘要替换旧历史
```

**提取特点**：
- **不是事实抽取**：目标是压缩当前任务上下文，而非沉淀长期事实
- **模板化摘要**：保留 Goal、Constraints、Progress、Decisions、Next Steps、Relevant Files
- **与消息流一体化**：摘要结果直接写回 `message + part`
- **自动续跑**：压缩后可自动注入一条“继续工作/必要时提问”的 synthetic user message

---

## 4. 记忆召回对比

### 4.1 Mem0：三信号融合排序

```typescript
// scoreAndRank() — 核心融合算法
combined = (semanticScore + bm25Score + entityBoost) / maxPossible

// 自适应 maxPossible
仅语义: 1.0 | 语义+BM25: 2.0 | 语义+实体: 1.5 | 全部: 2.5

// 实体 boost 计算
boost = similarity * ENTITY_BOOST_WEIGHT(0.5) * (1.0 / (1.0 + 0.001 * (numLinked - 1)^2)
// 扩散衰减：热门实体的 boost 被稀释
```

**召回流程**：
1. **语义搜索**：query embedding → vectorStore.search(topK * 4，最低 60）→ 为融合提供候选池
2. **BM25 关键词搜索**：内建 BM25 实现（可选，需存储后端支持）
3. **实体增强**：查询中提取实体 → 在实体存储中搜索 → 关联的记忆 ID 获得 boost
4. **融合排序**：语义 + BM25 + 实体 boost → 按 combined 降序 → 取 topK
5. **门槛过滤**：语义分数低于 threshold 的候选直接淘汰

**亮点**：
- **自适应 BM25 参数**：根据查询词数选择 sigmoid 参数（短查询 midpoint=5.0，长查询 midpoint=12.0）
- **实体扩散衰减**：热门实体（关联大量记忆）的 boost 被稀释，避免排序被少数高频实体垄断
- **Over-fetch**：语义搜索取 4x topK，为融合排序提供充足候选

### 4.2 Mastra：观察上下文注入

```typescript
// getContext() — 为 LLM 调用组装完整上下文
{
  systemMessage: string | undefined,  // 观察上下文 + Working Memory + 指令
  messages: MastraDBMessage[],       // 未观察消息或最近历史
  hasObservations: boolean,           // 是否有观察结果
  omRecord: ObservationalMemoryRecord | null,  // OM 记录
  continuationMessage,              // OM 继续提醒
  otherThreadsContext: string | undefined,     // 其他线程上下文（resource scope）
}
```

**召回流程**：
1. **系统消息构建**：
   - OM 观察上下文（`omEngine.buildContextSystemMessage()`）
   - Working Memory 上下文（`getSystemMessage()`）
   - 合并为完整的系统消息

2. **消息加载**：
   - OM 活跃时：只加载未观察消息（after lastObservedAt）
   - OM 未启用时：加载最近 N 条消息（lastMessages）

3. **继续提醒**：OM 活跃时注入 `<system-reminder>` 提醒 LLM 继续工作

**亮点**：
- **观察上下文优先**：LLM 首先看到压缩后的观察结果（精炼记忆），而非原始对话
- **Working Memory 注入**：结构化事实/偏好直接注入系统消息
- **未观察消息**：只加载新消息，避免重复处理已压缩内容
- **其他线程上下文**：resource scope 时聚合其他线程的观察结果

### 4.3 OpenCode：摘要折叠回注

```typescript
// 核心链路
filterCompactedEffect(sessionID)
-> toModelMessagesEffect(msgs, model)
```

**召回流程**：
1. 识别已完成的 compaction 对（user compaction + assistant summary）
2. 折叠更早的旧历史
3. 保留最近 tail 原始消息
4. 将 compaction user message 转成 `What did we do so far?`
5. 将 assistant summary 作为回答一起注入模型

**亮点**：
- **无需向量检索**：直接在消息层做压缩视图
- **兼容所有模型消息协议**：把记忆伪装成普通对话消息
- **summary + tail 折中**：既减小上下文，又保留最近原文细节

---

## 5. 存储架构对比

### 5.1 Mem0：VectorStore + HistoryManager + Entity Store

```typescript
// VectorStore 接口（工厂模式）
interface VectorStore {
  insert(vectors, ids, payloads): Promise<void>;
  search(query, topK, filters): Promise<VectorStoreResult[]>;
  keywordSearch?(query, topK, filters): Promise<...>;  // 可选
  get(vectorId): Promise<...>;
  update(vectorId, vector, payload): Promise<void>;
  delete(vectorId): Promise<void>;
  list(filters, topK): Promise<[VectorStoreResult[], number]>;
}

// 默认实现：MemoryVectorStore（better-sqlite3）
// Schema: vectors(id TEXT PRIMARY KEY, vector BLOB, payload TEXT)
// 搜索：全表扫描 + cosine similarity（O(N)）
// BM25：内建实现（IDF、TF、文档长度归一化）
```

**存储后端**：
- **VectorStore**：Memory（SQLite，默认）/ Qdrant / Redis / pgvector / Supabase / ...
- **HistoryManager**：SQLite（记录记忆变更历史：ADD/UPDATE/DELETE）
- **Entity Store**：独立的集合（`collectionName_entities`），存储实体及其关联的记忆 ID

### 5.2 Mastra：MemoryStorage（多后端可选）

```typescript
// MemoryStorage 接口（插件式后端）
interface MemoryStorage {
  // Thread 操作
  saveThread({ thread }): Promise<StorageThreadType>;
  updateThread({ id, title, metadata }): Promise<...>;
  getThreadById({ threadId }): Promise<...>;
  listThreads({ resourceId, perPage, page, filter }): Promise<...>;
  deleteThread({ threadId }): Promise<void>;

  // Message 操作
  saveMessages({ messages }): Promise<...>;
  listMessages({ threadId, resourceId, perPage, page, orderBy, filter }): Promise<...>;
  listMessagesByResourceId({ resourceId, ... }): Promise<...>;

  // Resource 操作（Working Memory）
  getResourceById({ resourceId }): Promise<...>;
  updateResource({ resourceId, workingMemory }): Promise<void>;

  // Observational Memory
  getObservationalMemory({ threadId, resourceId }): Promise<ObservationalMemoryRecord>;
  initializeObservationalMemory({ ... }): Promise<...>;
  supportsObservationalMemory: boolean;
}
```

**存储后端**：
- **LibSQL**（`@mastra/libsql`，默认）
- **PostgreSQL + pgvector**（`@mastra/pg`）
- **MongoDB**（`@mastra/mongodb`）
- **Cloudflare D1**（`@mastra/cloudflare`）
- **Upstash**（`@mastra/upstash`）

### 5.3 OpenCode：SQLite 会话存储

```typescript
session
message
part
```

**存储特点**：
- `session`：会话元信息 + summary 统计字段
- `message`：消息元信息，`data` 为 JSON
- `part`：消息片段，`data` 为 JSON
- 真实写库由 `projectors.ts` 完成：`领域服务 -> SyncEvent -> Projector -> SQLite`

**结论**：
- OpenCode 没有独立 `memory` 表
- 没有长期 embedding/vector store 主链路
- 记忆能力直接附着在 session/message/part 模型上

---

## 6. 设计哲学对比

| 维度 | Mem0 | Mastra | OpenCode |
|------|------|-------|----------|
| **设计目标** | 通用记忆层，可独立部署或接入任何框架 | Agent 框架深度集成，开箱即用 | 保证长编码会话在上下文受限时继续工作 |
| **提取哲学** | 单次批量提取，事后处理 | 持续观察，后台压缩，实时精炼 | 超长时压缩当前会话 |
| **时间处理** | 事后锚定（Observation Date） | 实时锚定（系统提示词内置）| 依附消息时间线，无长期时间语义抽取 |
| **实体处理** | 独立实体系统，关联记忆图谱 | 依赖 Observer 提取的结构化观察，无独立实体 | 无实体层 |
| **压缩策略** | 无压缩，只做 ADD（不 UPDATE/DELETE） | 多级压缩（0-4），Reflector 重组观察 | 单级 compaction，总结旧历史并保留 recent tail |
| **作用域** | 三元组（user_id/agent_id/run_id） | 二元组（thread/resource），更简洁 | 单 session |
| **扩展性** | 工厂模式（Embedder/LLM/VectorStore/HistoryManager）| 插件式后端（MemoryStorage），统一接口 | 建立在既有消息系统上，扩展轻但边界更窄 |

---

## 7. 亮点设计对比

### 7.1 Mem0 独有亮点

| 亮点 | 说明 | Mastra 是否具备 |
|------|------|----------------|
| **UUID→整数映射** | LLM 提取时映射 UUID → 顺序整数，防止幻觉生成假 ID | ❌ 无此设计 |
| **自适应 BM25** | 根据查询词数自动选择 sigmoid 参数 | ❌ 无 BM25 实现 |
| **实体扩散衰减** | `1.0 / (1.0 + 0.001 * (numLinked - 1)^2)` | ❌ 无实体系统 |
| **ADDITIVE 提取** | 只做 ADD，不 UPDATE/DELETE，简化 prompt | ❌ 有 UPDATE（Working Memory）|
| **Agent 视角后缀** | 自动根据作用域调整记忆表述 | ❌ 无此概念 |

### 7.2 Mastra 独有亮点

| 亮点 | 说明 | Mem0 是否具备 |
|------|------|---------------|
| **三 Agent 架构** | Actor + Observer + Reflector，最接近人类记忆机制 | ❌ 单 LLM |
| **Observational Memory** | 后台持续压缩对话，生成精练记忆 | ❌ 无此概念 |
| **多级压缩** | 0-4 级，按模型选择起始级别（见 `getCompressionStartLevel()`） | ❌ 无压缩机制 |
| **Working Memory** | Markdown/JSON Schema 双模式，结构化事实/偏好 | ❌ 无此概念 |
| **Emoji 优先级标记** | 🔴 High / 🟡 Medium / 🟢 Low / ✅ Completed | ❌ 无此设计 |
| **异步缓冲** | Observer 可在后台运行，不阻塞主 Agent | ❌ 无此概念 |
| **模型路由** | ModelByInputTokens，按输入 token 数选模型 | ❌ 无此功能 |
| **时间锚定** | 系统提示词内置，相对→绝对日期 | ✅ 有类似机制（Observation Date） |
| **继续提醒** | OM 活跃时注入 `<system-reminder>` | ❌ 无此设计 |
| **互斥锁** | `Mutex` 防止并发更新竞态 | ❌ 无显式锁 |
| **嵌入缓存** | xxhash 键 + Map，避免重复嵌入 | ❌ 源码未见 xxhash / 嵌入缓存 |
| **分块策略** | `chunkText(text, tokenSize=4096)` 按词边界 | ❌ 源码未见 chunkText 实现 |

### 7.3 OpenCode 独有亮点

| 亮点 | 说明 | Mem0 / Mastra 是否具备 |
|------|------|------------------------|
| **CompactionPart 锚点** | 用消息 part 标记压缩边界与 tail 起点 | ❌ 两者都不是这个设计 |
| **summary + tail** | 旧历史压缩，最近原文保留 | ❌ Mem0 无；✅ Mastra 有“压缩+未观察消息”但实现不同 |
| **消息伪装式回注** | 把记忆伪装成普通对话消息重新注入模型 | ❌ 两者不采用这一路径 |
| **自动续跑提示** | 压缩后可自动塞入 synthetic continue message | ❌ 两者未见同构设计 |
| **与工具时间线一体化** | tool/file/reasoning/compaction 都在同一消息流 | ❌ 两者不是以同一消息流为核心 |

### 7.4 共有亮点

| 亮点 | Mem0 | Mastra | OpenCode |
|------|------|--------|----------|
| **全链路回退** | ✅ 批量失败→逐条，embedBatch 失败→逐条 embed | ✅ 异步失败→同步，缓冲区失败→跳过 | ✅ 超长后自动 compaction，再继续会话 |
| **作用域过滤** | ✅ user_id/agent_id/run_id | ✅ thread/resource | ✅ session |
| **结构化输出** | ✅ LLM `json_object` 模式 + Zod Schema | ✅ Observer/Reflector 使用 XML 结构 | ✅ 固定 Markdown summary template |
| **去重/避免重复处理** | ✅ 三层（LLM 提示词 + MD5 hash + 实体相似度 ≥0.95） | ✅ 基于时间边界 `lastObservedAt`，避免重复观察同一消息 | ✅ `filterCompacted()` 折叠已压缩历史 |

> ⚠️ 在前次版本中列为"共有"的"嵌入缓存（xxhash）"与"分块策略（chunkText）"仅 Mastra 具备；经 ripgrep 验证 Mem0 TS SDK 源码中**零匹配**，已移动到上方 Mastra 独有表格。

---

## 8. 适合场景对比

| 场景 | 推荐 | 理由 |
|------|------|------|
| **快速接入现有 Agent** | **Mem0** | 托管 API 开箱即用，自托管也只需几行代码 |
| **从零构建 TS Agent** | **Mastra** | 框架内置，深度集成，四层记忆开箱即用 |
| **需要实体关联图谱** | **Mem0** | 独立实体系统，关联记忆，召回时实体 boost |
| **长对话持续压缩** | **Mastra / OpenCode** | Mastra 更完整；OpenCode 更聚焦工程型会话压缩 |
| **结构化工作记忆** | **Mastra** | Working Memory 支持 JSON Schema，深度合并更新 |
| **多后端部署** | **Mastra** | MemoryStorage 插件式后端，LibSQL/PG/Mongo/Cloudflare 任选 |
| **关键词+语义混合召回** | **Mem0** | BM25 + 语义 + 实体 boost 三信号融合 |
| **资源受限环境** | **OpenCode / Mem0** | OpenCode 不引入向量库；Mem0 也相对轻量 |
| **只想先解决上下文爆炸** | **OpenCode** | 不做长期记忆，直接做 compaction 最短路径 |

---

## 9. 对你项目的借鉴建议

### 9.1 最小可行实现（MVP）

如果你要组合三者的优点，推荐顺序改成：

**阶段 0：先做 OpenCode 风格短期压缩记忆**
```typescript
// session history 全量保存
// 超长时 compaction
// summary + recent tail 回注
// 先解决“会话太长没法继续工作”问题
```

**阶段 1：基础语义记忆**（参考 Mem0 + 你的 stage-4-rag）
```typescript
// 复用你已有的 text-embedding-v3 + 向量存储
// 简化为单条 LLM 调用，提取事实列表（json_object 模式）
// 召回：纯语义搜索（cosine similarity），无 BM25 和实体 boost
// 作用域：先实现 thread scope（单线程隔离）
```

**阶段 2：加入 Working Memory**（参考 Mastra）
```typescript
// 先用 Markdown 模式（简单直观）
// 实现 updateWorkingMemoryTool（参考 Mastra 的 deepMergeWorkingMemory）
// 注入：在系统消息中注入 Working Memory 内容
```

**阶段 3：Observational Memory（可选，高级）**（参考 Mastra）
```typescript
// 简化版 Observer：单条 LLM 调用，从对话提取结构化观察结果
// 时间锚定：参考 Mastra 的 buildMessageRange() 和日期解析
// 简化版 Reflector：当观察结果超过阈值时，压缩为摘要
// 异步缓冲：先实现同步模式，后续再加异步
```

### 9.2 关键可复用代码模式

| 模式 | 来源 | 可复用点 |
|------|------|----------|
| **summary + tail** | OpenCode | 用压缩摘要替换旧历史，同时保留最近原始上下文 |
| **Compaction 锚点** | OpenCode | 用特殊消息/part 标记压缩边界与 tail 起点 |
| **消息伪装式回注** | OpenCode | 把记忆结果转成普通消息重新送模，减少专用协议复杂度 |
| **嵌入缓存** | Mastra | `xxhash` 键 + `Map` 缓存，避免相同内容重复嵌入（见 `packages/memory/src/index.ts` 的 `embeddingCache`）|
| **分块策略** | Mastra | `chunkText(text, tokenSize=4096)` 按词边界分块，避免截断 |
| **互斥锁** | Mastra | `async-mutex`，防止并发更新同一 resource/thread 的竞态 |
| **模型路由** | Mastra | `ModelByInputTokens`，根据输入 token 数自动选模型 |
| **时间锚定** | Mem0 + Mastra | 相对时间 → 绝对日期（Mem0 用 Observation Date，Mastra 用 Observer 提示词内置）|
| **UUID→整数映射** | Mem0 | 防止 LLM 在已有记忆 ID 上幻觉 |
| **自适应 BM25** | Mem0 | 按查询词数选 sigmoid 参数（5 级阶梯）|
| **实体扩散衰减** | Mem0 | `1.0 / (1.0 + 0.001 * (numLinked - 1)^2)` — 热门实体 boost 稀释 |
| **全链路回退** | Mem0 + Mastra + OpenCode | 批量失败/异步失败/上下文超长后压缩续跑 |

### 9.3 推荐学习路径

```
1. 先学 OpenCode 的 session compaction
   → 理解如何在不引入长期记忆库的前提下解决上下文爆炸

2. 再学 Mem0 的提取管道（8 Phase）
   → 理解单次 LLM 调用如何完成提取→去重→持久化全流程

3. 再学 Mastra 的四层架构
   → 理解 Conversation → Working → Semantic → Observational 如何递进

4. 深入 Mastra 的 Observer + Reflector
   → 理解三 Agent 架构如何实现持续压缩

5. 对比三者的召回策略
   → Mem0 的语义检索 vs Mastra 的观察上下文 vs OpenCode 的 summary+tail

6. 选择适合你项目的子集实现
   → 不要试图实现所有亮点，选择符合场景的
```

---

## 10. 快速参考表

| 想了解... | 看这里 |
|-------------|--------|
| **Mem0 完整架构** | `docs/mem0-architecture-analysis.md` |
| **Mastra 完整架构** | `docs/mastra-architecture-analysis.md` |
| **OpenCode 完整架构** | `docs/opencode-memory-architecture-analysis.md` |
| **三者详细对比** | 本文档 |
| **Mem0 源码** | `references/mem0/mem0-ts/src/oss/src/memory/index.ts` |
| **Mastra 源码** | `references/mastra/packages/memory/src/index.ts` |
| **OpenCode 源码** | `references/opencode/packages/opencode/src/session/compaction.ts` |
| **Mem0 提取 Prompt** | `references/mem0/mem0-ts/src/oss/src/prompts/index.ts` |
| **Mastra Observer Prompt** | `references/mastra/packages/memory/src/processors/observational-memory/observer-agent.ts` |
| **Mastra Reflector Prompt** | `references/mastra/packages/memory/src/processors/observational-memory/reflector-agent.ts` |
