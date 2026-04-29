# Mastra 记忆系统架构分析

> 分析对象：Mastra AI TypeScript Agent 框架记忆系统
> 仓库：`mastra-ai/mastra` — `packages/memory/`
> 分析日期：2026-04-27（已核对源码修订）

---

## 1. 项目整体架构

### 1.1 四层记忆系统

Mastra 的记忆系统是目前 TS/JS 生态中最完整的实现，核心设计是**四层互补**的记忆架构：

| 层级 | 类名 / 模块 | 作用 | 存储位置 |
|------|--------------|------|----------|
| **Conversation History** | `MastraMemory` (基类) | 原始消息序列持久化 | `MemoryStorage` (LibSQL/PostgreSQL/pgvector) |
| **Working Memory** | `updateWorkingMemoryTool` | 结构化事实/偏好（Markdown 或 JSON Schema） | Thread metadata 或 Resource 表 |
| **Semantic Recall** | `Memory` 类 (`recall()`) | 向量嵌入 + 语义搜索 | Vector Store (LibSQLVector/Qdrant/pgvector) |
| **Observational Memory** | `ObservationalMemory` 引擎 | Observer + Reflector 压缩对话 → 密集观察结果 | `MemoryStorage` (observational_memory 表) |

**设计哲学**：从简单到复杂递进——不需要 Observational Memory 的场景，前三者已足够；长对话场景开启 OM 获得类人记忆压缩。

### 1.2 核心类依赖关系

```
Memory (主类，继承 MastraMemory)
├── embedder: Embedder        ← AI SDK 嵌入模型
├── vector: VectorStore      ← LibSQLVector / Qdrant / pgvector
├── storage: MemoryStorage  ← LibSQL / PostgreSQL / MongoDB
├── Working Memory Tools
│   ├── updateWorkingMemoryTool (Markdown 模式)
│   └── __experimental_updateWorkingMemoryToolVNext (实验性)
├── OM Engine (懒初始化)
│   └── ObservationalMemory
│       ├── ObserverRunner      ← 运行 Observer Agent
│       ├── ReflectorRunner    ← 运行 Reflector Agent
│       ├── BufferingCoordinator ← 管理异步缓冲
│       └── TokenCounter        ← Token 计数
└── OM Tools
    └── recallTool          ← 注入观察上下文到 Agent
```

---

## 2. Memory 主类（packages/memory/src/index.ts）

### 2.1 核心职责

`Memory` 继承自 `@mastra/core` 的 `MastraMemory`，添加了：
- Thread 配置支持（Working Memory 模板、作用域）
- 消息注入（隐藏 Working Memory 标签、过滤系统提醒）
- 语义召回（向量搜索 + 消息注入）
- Observational Memory 引擎懒初始化

### 2.2 recall() — 记忆召回入口

> 注：`recall()` 是对向量存储 + 消息存储的**直接查询接口**，返回结果用于进一步上下文组装。真正被 Agent 运行时消费、组装系统消息与消息窗口的入口是 §2.4 的 `getContext()`。

```typescript
async recall({
  threadId, resourceId,          // 作用域标识
  vectorSearchString,           // 用于语义搜索的查询文本
  perPage, page, orderBy,      // 分页
  filter,                       // 额外过滤条件
  threadConfig,                 // 线程级配置覆盖
  includeSystemReminders,       // 是否包含系统提醒消息
  observabilityContext,          // 可观测性上下文
})
```

**召回策略**（按配置组合）：

```
1. 语义召回（Semantic Recall）
   ├─ embedMessageContent(vectorSearchString) → 生成嵌入
   ├─ createEmbeddingIndex(dimension) → 创建/获取向量索引
   └─ vector.query(queryVector, topK, filter) → 语义搜索

2. 对话历史（Conversation History）
   ├─ 判断：historyDisabledByConfig ？
   │   └─ YES → 只返回语义结果（perPage=0）
   ├─ 判断：shouldGetNewestAndReverse = !orderBy && perPage !== false
   │   ├─ YES（无显式 orderBy 且不是全量）→ 先 DESC 取最新，再反转恢复时间序
   │   └─ NO → 直接按指定顺序查询
   └─ memoryStore.listMessages(...) → 获取原始消息

> 注：`recall()` 和 `getContext()` 的 "加载最近 N 条" 分支都使用 DESC→反转技巧（两处代码均确认存在）。

3. 结果组装
   ├─ MessageList.add(rawMessages, 'memory')
   ├─ filterSystemReminderMessages(...) → 过滤系统提醒
   └─ 返回 { messages, usage, total, page, perPage, hasMore }
```

**关键设计亮点**：

| 设计点 | 说明 |
|--------|------|
| **向量搜索过滤** | `resource-scoped` 用 `resource_id` 过滤，`thread-scoped` 用 `thread_id` 过滤 |
| **DESC→反转技巧** | 无显式 orderBy 时先 DESC 取最新消息，再反转 → 保证 LLM 看到时间序上下文 |
| **嵌入缓存** | `embeddingCache`（xxhash 键）→ 相同内容不重复嵌入，节省成本 |
| **多版本 AI SDK 支持** | 自动检测 `specificationVersion`：v3→embedManyV6，v2→embedManyV5，默认→embedMany |
| **分块嵌入** | `chunkText(content, tokenSize=4096)` → 按词边界分块，避免截断 |

### 2.3 saveMessages() — 消息持久化

```typescript
async saveMessages({
  messages: MastraDBMessage[],  // 要保存的消息
  threadConfig,                      // 配置
  observabilityContext,               // 可观测性
})
```

**处理流程**：

```
1. 预处理消息
   ├─ updateMessageToHideWorkingMemoryV2(msg) → 移除 Working Memory 标签
   ├─ 过滤：tool-invocation 中 toolName='updateWorkingMemory' 的消息部分
   └─ MessageList.add(updatedMessages, 'memory') → 转换为 DB 格式

2. 持久化到存储
   └─ memoryStore.saveMessages({ messages: dbMessages })

3. 语义召回嵌入（如果启用）
   ├─ 遍历 messages，提取文本内容
   ├─ embedMessageContent(text) → 批量嵌入
   ├─ createEmbeddingIndex(dimension) → 获取索引名
   ├─ vector.upsert({ vectors, metadata }) → 批量写入向量存储
   └─ 注意：metadata 包含 message_id, thread_id, resource_id

4. 返回 { messages, usage: { tokens } }
```

**亮点**：
- 批量嵌入优先于 DB 操作（不占连接池）
- 向量 upsert 一次性批量写入（避免循环 N 次）
- 自动创建向量索引（索引名格式：`memory_messages{separator}{dimension}`）

### 2.4 getContext() — 上下文注入（核心）

这是 Mastra 记忆系统的**最关键方法**，为 LLM 调用组装完整上下文：

```typescript
async getContext({
  threadId, resourceId,
  memoryConfig,
})
```

**返回结构**：
```typescript
{
  systemMessage: string | undefined,      // 完整系统消息（OM + Working Memory）
  messages: MastraDBMessage[],       // 未观察消息或最近历史
  hasObservations: boolean,           // 是否有观察结果
  omRecord: ObservationalMemoryRecord | null,  // OM 记录
  continuationMessage: MastraDBMessage | undefined,  // 继续提醒消息
  otherThreadsContext: string | undefined,     // 其他线程上下文（resource scope）
}
```

**组装流程**：

```
1. 系统消息构建（systemMessage）
   ├─ [1] OM 观察上下文
   │   ├─ omEngine.getRecord(threadId, resourceId)
   │   ├─ omEngine.buildContextSystemMessage(...) → 观察结果注入
   │   ├─ resource scope 时：omEngine.getOtherThreadsContext() → 其他线程上下文
   │   └─ 追加 continuationMessage（提醒 LLM 继续）
   ├─ [2] Working Memory 上下文
   │   ├─ getWorkingMemoryTemplate(config) → 获取模板
   │   ├─ getWorkingMemory({threadId, resourceId}) → 获取数据
   │   └─ getSystemMessage(...) → 生成工具指令或只读指令
   └─ systemParts.join('\n\n') → 合并

2. 消息加载（messages）
   ├─ OM 活跃时：
   │   ├─ 有 lastObservedAt？→ 只加载此后的消息
   │   └─ 无 lastObservedAt？→ 加载 ALL 消息（首次）
   └─ OM 未启用时：
       ├─ lastMessages=false？→ 返回空（禁用历史）
       └─ 否则：加载最近 N 条消息（DESC 取最新 → 反转）

3. 返回完整上下文
```

**设计精妙之处**：
- **OM 首次激活**：`lastObservedAt=null` 时加载 ALL 消息，让阈值检查能基于完整上下文触发
- **分域策略**：`resource` scope 时跨线程聚合，`thread` scope 时单线程隔离
- **继续提醒**：OM 活跃时注入 `<system-reminder>` 提醒 LLM 观察已完成

---

## 3. Observational Memory（观察者记忆，亮点设计）

### 3.1 三 Agent 架构

```
┌────────────┐
│                       主 Agent（Actor）                          │
│  ├─ 看到：观察结果 + Working Memory + 未观察消息            │
│  └─ 调用工具、生成回复                                 │
├─────────────┤
│                    ↑ 注入上下文                          │
│            ObservationalMemory 引擎                          │
│  ├─ Observer Runner ──▶ Observer Agent（LLM）               │
│  │   └─ 从消息中提取观察结果（observations）             │
│  ├─ Reflector Runner ──▶ Reflector Agent（LLM）              │
│  │   └─ 压缩观察结果为精炼记忆                       │
│  └─ BufferingCoordinator ──▶ 异步缓冲管理                    │
└────────────┘
```

**关键洞察**：这是目前开源 Agent 框架中**最接近人类记忆机制**的设计——Observer 像"后台潜意识"不断压缩对话，Reflector 像"睡眠整理记忆"定期重组。

### 3.2 ObservationalMemory 类（引擎）

**初始化配置**（构造函数）：

```typescript
new ObservationalMemory({
  storage,                         // MemoryStorage 实例
  scope: 'thread' | 'resource',   // 作用域
  model: 'google/gemini-2.5-flash', // Observer + Reflector 共享默认模型
  shareTokenBudget: true,           // 是否共享 token 预算
  retrieval,                         // 召回相关配置（可选）
  activateAfterIdle: '5m',          // 顶层：空闲后激活（可选）
  activateOnProviderChange: false,  // 顶层：模型切换时激活（可选）
  onIndexObservations,              // 观察索引钩子（可选）
  observation: {                     // Observer 配置
    model,                           // Observer 专属模型（可覆盖顶层）
    messageTokens: 30_000,         // 触发阈值（token 数）
    modelSettings: { temperature: 0.3, maxOutputTokens: 100_000 },
    providerOptions,               // 例如 Google thinkingConfig
    maxTokensPerBatch: 10_000,      // 单批最大 token
    bufferTokens: 0.2,              // 异步缓冲大小（**默认是 0-1 比例，即 messageTokens 的 20%**；也支持绝对 token 数）
    bufferActivation: 0.8,         // 激活阈值（比例或绝对 token）
    blockAfter,                     // 阻塞阈值（可选）
    previousObserverTokens,        // 上次 Observer 可见的历史 token 数
    instruction,                    // 自定义 Observer 指令
    threadTitle,                    // 是否生成线程标题
  },
  reflection: {                      // Reflector 配置
    model,                           // Reflector 专属模型
    observationTokens: 40_000,    // 反射触发阈值
    modelSettings: { temperature: 0, maxOutputTokens: 100_000 },
    providerOptions,
    bufferActivation: 0.5,
    blockAfter,
    instruction,
  },
})
```

> ⚠️ 注意：`activateAfterIdle`、`activateOnProviderChange`、`retrieval`、`onIndexObservations` 是 **顶层**字段，不在 `observation` 子对象中。

**核心方法**：

| 方法 | 作用 |
|------|------|
| `getRecord(threadId, resourceId)` | 获取/创建 OM 记录（lastObservedAt, observationTokenCount 等） |
| `getContextSystemMessage(...)` | 构建观察上下文系统消息（注入到主 Agent） |
| `getOtherThreadsContext(resourceId, threadId)` | resource scope 时获取其他线程上下文 |
| `withLock(key, fn)` | 序列化 OM/Reflection 周期（防竞态） |
| `observedMessageIds` | 本次生命周期内已观察的消息 ID（防重复） |

**关键设计**：

1. **Token 预算共享**：
   - `shareTokenBudget: true` 时，Observer 和 Reflector **共享** `messageTokens + observationTokens` 的总预算
   - 动态计算阈值：`min = messageTokens, max = totalBudget`
   - 消息可扩展到未使用空间

2. **异步缓冲**（BufferingCoordinator）：
   - `bufferTokens` 定义缓冲大小（如 5000 tokens）
   - 消息先写入缓冲，达到 `bufferActivation` 阈值时触发 Observer
   - 支持 `async` 模式（后台运行）和 `sync` 模式（阻塞等待）

3. **模型路由**（ModelByInputTokens）：
   - 自动根据输入 token 数选择模型：`resolveModel(inputTokens) → { model, selectedThreshold }`
   - 例如：0-1000 tokens → modelA，1000-5000 → modelB
   - 用于实现成本优化（短对话用小模型，长对话用大模型）

### 3.3 Observer Agent（观察者）

**角色**：从对话消息中提取结构化观察结果。

**系统提示词**（`OBSERVER_EXTRACTION_INSTRUCTIONS`）：
- 区分**用户断言**（User stated）和**问题/请求**（User asked）
- 时间锚定：将相对时间（"昨天"、"下周"）转换为绝对日期
- Emoji 标记（**优先级标记，非角色标记**）：
  - 🔴 High：显式用户事实、偏好、未解决目标、关键上下文
  - 🟡 Medium：项目细节、学到的信息、工具结果
  - 🟢 Low：次要细节、不确定的观察
  - ✅ Completed：任务已完成、问题已解决、子任务已结束（显式完成信号，防止重复工作）
- 格式：(HH:MM) 观察内容。（meaning DATE) — 时间锚定在末尾

**关键指令亮点**：

```
CRITICAL: DISTINGUISH USER ASSERTIONS FROM QUESTIONS
- "I have two kids" → 🔴 (14:30) User stated has two kids
- "Can you help me with X?" → 🔴 (15:00) User asked help with X

STATE CHANGES AND UPDATES:
- "I'm going to start doing X instead of Y" → "User will start doing X (changing from Y)"
- 必须显式表达状态变化，让记忆系统理解"从什么变到什么"

PRESERVE UNUSUAL PHRASES:
- "I did a movement session" → 🔴 (09:15) User did a "movement session" (their term)
- 保留用户原话中的特殊术语
```

**输出格式示例**：
```
(14:30) User stated has two kids.
(14:35) User asked best way to do Y.
(14:40) Assistant recommended hotels: Hotel A (near station), Hotel B (budget).
(15:00) User will start doing X (changing from Y). (meaning March 15, 2026)
```

### 3.4 Reflector Agent（反射器）

**角色**：当观察结果过长时，压缩和重组为可管理的密集记忆。

**系统提示词**（`buildReflectorSystemPrompt()`）：

```
You are the memory consciousness of an AI assistant.
Your memory observation reflections will be the ONLY information the assistant has.

Take the existing observations and rewrite them to make it easier to continue
into the future with this knowledge.

IMPORTANT: your reflections are THE ENTIRE memory system.
Any information you do not add to your reflections will be immediately forgotten.
```

**压缩级别**（CompressionLevel 0-4）：

| 级别 | 指导 | 使用场景 |
|------|------|----------|
| **0** | 无压缩指导（首次反射） | 观察结果较短时 |
| **1** | 温和压缩：合并相似项，保留近期细节 | 中等长度 |
| **2** | 激进压缩：大幅合并，保留关键事实 | 观察结果较长 |
| **3** | 关键压缩：只保留核心决策和结果 | 接近 token 上限 |
| **4** | 极限压缩：概括为段落级摘要 | 严重超限时 |

**输出格式**（XML 标签）：

```xml
<observations>
(14:30) User stated has two kids.
<thread id="thread-1">
(14:35) Working on auth feature.
</thread>
<thread id="thread-2">
(15:05) Debugging API endpoint.
</thread>
</observations>

<current-task>
Primary: User asked about X. Assistant should respond.
Secondary: Working on auth feature (waiting for user response).
</current-task>

<suggested-response>
I've updated the navigation. Let me walk you through the changes...
</suggested-response>
```

**多线程聚合**（resource scope）：
- 观察结果按 `<thread id="...">` 分组
- Reflector 会合并跨线程的通用事实（如用户偏好），保留线程特定上下文

---

## 4. Working Memory（工作记忆）

### 4.1 两种模式

| 模式 | 工具 | 数据格式 | 更新语义 |
|------|------|----------|----------|
| **Markdown 模式** | `updateWorkingMemoryTool` | Markdown 文本 | 替换（全量更新） |
| **JSON Schema 模式** | `updateWorkingMemoryTool`（schema 配置） | 结构化 JSON | 合并（深度合并，字段级更新） |

### 4.2 Markdown 模式

**工具定义**：
```typescript
updateWorkingMemoryTool(memoryConfig?)
```

**输入 Schema**：
```typescript
z.object({
  memory: z.string().describe('The Markdown formatted working memory content to store.'),
})
```

**更新逻辑**：
1. 获取现有 Working Memory
2. 检查是否试图插入空模板（防数据丢失）
3. 检查 searchString（如果提供）→ 替换指定行
4. 否则：追加到末尾（`existing + '\n' + newMemory`）
5. 写入 Thread metadata 或 Resource 表

**亮点**：
- **防呆设计**：LLM 返回空模板时拒绝更新，防止数据丢失（见 `working-memory.ts` 的 normalized template 比较逻辑）
- **互斥锁**：`Mutex` 防止并发更新同一 resource/thread 的竞态

> 注：基于 `searchString` 的**精准行替换**属于实验性工具 `__experimental_updateWorkingMemoryToolVNext`（见 4.3）；稳定版 `updateWorkingMemoryTool` 只做全量替换 + 空模板保护。

### 4.3 JSON Schema 模式（亮点）

**配置**：
```typescript
workingMemory: {
  enabled: true,
  scope: 'resource',  // 或 'thread'
  schema: z.object({ name: z.string(), preferences: z.array(z.string()) }),
}
```

**工具**：`__experimental_updateWorkingMemoryToolVNext(config)`

**额外能力（VNext 独有）**：
- `searchString`：指定要定位/替换的文本片段，实现精准行替换（默认为追加）
- `updateReason`：`'append-new-memory' | 'clarify-existing-memory' | 'replace-irrelevant-memory'`，显式声明更新意图

**更新逻辑**（深度合并）：
```typescript
function deepMergeWorkingMemory(existing, update) {
  for (const key of Object.keys(update)) {
    const updateValue = update[key];
    const existingValue = result[key];

    if (updateValue === null) { delete result[key]; continue; }  // null → 删除字段
    if (Array.isArray(updateValue)) { result[key] = updateValue; continue; }  // 数组 → 整量替换
    if (typeof updateValue === 'object') {  // 对象 → 递归合并
      result[key] = deepMergeWorkingMemory(existingValue, updateValue);
      continue;
    }
    result[key] = updateValue;  // 基元值 → 覆盖
  }
  return result;
}
```

**亮点**：
- **null 语义**：传递 `null` 删除字段，而非设置为 null
- **数组替换**：数组整量替换（不逐元素合并）
- **LLM 容错**：如果 LLM 漏传 `memory` 包装层，自动修复（`stripNullsFromOptional`）

---

## 5. Semantic Recall（语义召回）

### 5.1 嵌入生成

**多版本 AI SDK 支持**：
```typescript
const specVersion = this.embedder.specificationVersion;
switch (specVersion) {
  case 'v3': embedFn = embedManyV6; break;  // AI SDK v4
  case 'v2': embedFn = embedManyV5; break;  // AI SDK v5
  default:  embedFn = embedMany; break;       // AI SDK v4 默认
}
```

**嵌入缓存**（节省成本）：
```typescript
private embeddingCache = new Map<string, {
  chunks: string[], embeddings: number[][], usage?: { tokens }, dimension: number
}>();

const key = (await this.hasher).h32(content);  // xxhash 比内容字符串更省内存
const cached = this.embeddingCache.get(key);
if (cached) return cached;  // 缓存命中
```

**分块策略**：
```typescript
chunkText(text, tokenSize = 4096) {
  const CHARS_PER_TOKEN = 4;  // OpenAI tokenization 估算
  const charSize = tokenSize * CHARS_PER_TOKEN;
  // 按词边界分块，避免截断单词
  let currentChunk = '';
  for (const word of words) {
    if (currentChunk.length + word.length > charSize) {
      chunks.push(currentChunk);
      currentChunk = word;
    } else { currentChunk += ' ' + word; }
  }
  return chunks;
}
```

### 5.2 向量存储

**索引命名**：`memory{separator}messages{dimension}`（如 `memory-messages-1536`）

**Upsert 逻辑**（批量写入）：
```typescript
// 1. 收集所有消息的嵌入
const allVectors: number[][] = [];
const allMetadata = [];
for (const data of embeddingData) {
  allVectors.push(...data.embeddings);
  allMetadata.push(...data.metadata.map(m => ({
    message_id: m.message_id,
    thread_id: m.thread_id,
    resource_id: m.resource_id,
  })));
}

// 2. 单次批量 upsert（避免 N 次循环）
await this.vector.upsert({
  indexName,
  vectors: allVectors,
  metadata: allMetadata,
});
```

**搜索过滤**：
- `resource-scoped`：`filter: { resource_id: resourceId }`
- `thread-scoped`：`filter: { thread_id: threadId }`

---

## 6. 存储层设计

### 6.1 MemoryStorage 接口

```typescript
interface MemoryStorage {
  // Thread 操作
  saveThread({ thread }): Promise<StorageThreadType>;
  updateThread({ id, title, metadata }): Promise<StorageThreadType>;
  getThreadById({ threadId }): Promise<StorageThreadType | null>;
  listThreads({ resourceId, perPage, page, filter }): Promise<StorageListThreadsOutput>;
  deleteThread({ threadId }): Promise<void>;

  // Message 操作
  saveMessages({ messages }): Promise<{ messages, usage }>;
  listMessages({ threadId, resourceId, perPage, page, orderBy, filter })
    : Promise<{ messages, total, page, perPage, hasMore }>;
  listMessagesByResourceId({ resourceId, perPage, page, orderBy, filter })
    : Promise<{ messages, total, page, perPage, hasMore }>;

  // Resource 操作（Working Memory 存储）
  getResourceById({ resourceId }): Promise<any>;
  updateResource({ resourceId, workingMemory }): Promise<void>;

  // Observational Memory 存储
  getObservationalMemory({ threadId, resourceId }): Promise<ObservationalMemoryRecord | null>;
  initializeObservationalMemory({ threadId, resourceId, config, ... }): Promise<ObservationalMemoryRecord>;
  supportsObservationalMemory: boolean;
}
```

### 6.2 支持的后端

| 后端 | 包名 | 适用场景 |
|------|--------|----------|
| **LibSQL** | `@mastra/libsql` | 本地开发、轻量部署（默认） |
| **PostgreSQL + pgvector** | `@mastra/pg` | 生产环境、需要 ACID |
| **MongoDB** | `@mastra/mongodb` | 文档模型、灵活 Schema |
| **Cloudflare D1** | `@mastra/cloudflare` | Edge 部署 |
| **Upstash** | `@mastra/upstash` | Serverless Redis |
| **Convex** | `@mastra/convex` | 实时同步 |

---

## 7. 关键设计亮点总结

### 7.1 架构层面

| 亮点 | 价值 |
|------|------|
| **四层互补** | 从简单到复杂递进，可按需启用 |
| **三 Agent 架构** | Actor + Observer + Reflector，最接近人类记忆机制 |
| **分域策略** | Thread（隔离）vs Resource（共享），灵活适配多用户/多 Agent |
| **懒初始化** | OM 引擎首次访问时才创建（`get omEngine()` getter） |

### 7.2 提取阶段

| 亮点 | 价值 |
|------|------|
| **时间锚定** | 将"昨天"转为"2026-04-26"，记忆永久可查 |
| **Emoji 标记** | 一眼区分用户陈述（🔴）、助手回复（🟡）、创意内容（🟢） |
| **状态变化显式化** | "从 A 改为 B"而非简单"现在是 B"，保留演变上下文 |
| **异常短语保留** | 用户说"movement session"就原样记录，不"翻译"为"exercise" |

### 7.3 压缩阶段

| 亮点 | 价值 |
|------|------|
| **多级压缩** | 0-4 级，根据观察结果长度自动选择 |
| **多线程聚合** | Resource scope 时合并通用事实，保留线程特定上下文 |
| **XML 结构化输出** | `<observations>`、`<current-task>`、`<suggested-response>` 分离关注点 |
| **压缩级别自适应** | Gemini 2.5 Flash 从 level 2 开始（因其偏向忠实转写，需要更强压缩压力），其他模型从 level 1 开始；见 `getCompressionStartLevel()` |

### 7.4 工程健壮性

| 亮点 | 价值 |
|------|------|
| **互斥锁** | `Mutex` 防止并发更新同一 resource/thread 的竞态 |
| **嵌入缓存** | xxhash 键 + 内容去重，避免重复嵌入 |
| **多版本 AI SDK** | 自动检测 v2/v3/v4，兼容不同版本 |
| **模型路由** | `ModelByInputTokens` 根据输入 token 数自动选模型，优化成本 |
| **异步缓冲** | Observer 可在后台运行，不阻塞主 Agent 响应 |
| **防呆设计** | LLM 返回空模板/重复数据时拒绝更新，防止数据丢失 |

---

## 8. 源码文件索引

| 文件 | 职责 |
|------|------|
| `packages/memory/src/index.ts` | **核心**：Memory 类，recall/saveMessages/getContext |
| `processors/observational-memory/observational-memory.ts` | **核心**：ObservationalMemory 引擎，Observer/Reflector 管理 |
| `processors/observational-memory/observer-agent.ts` | Observer Agent 系统提示词和输出解析 |
| `processors/observational-memory/reflector-agent.ts` | Reflector Agent 系统提示词和压缩级别 |
| `processors/observational-memory/observer-runner.ts` | Observer Runner，调用 Observer Agent |
| `processors/observational-memory/reflector-runner.ts` | Reflector Runner，调用 Reflector Agent |
| `processors/observational-memory/buffering-coordinator.ts` | 异步缓冲协调器 |
| `processors/observational-memory/token-counter.ts` | Token 计数器（支持模型路由） |
| `processors/observational-memory/model-by-input-tokens.ts` | 根据输入 token 数路由模型 |
| `tools/working-memory.ts` | Working Memory 更新工具（Markdown + JSON Schema） |
| `tools/om-tools.ts` | OM 召回工具，注入观察上下文 |
| `processors/observational-memory/constants.ts` | 常量定义（默认配置、提示词片段） |

---

## 9. 对你项目的借鉴建议

如果你要在 `stage-5-agent` 中实现类似的记忆系统，建议的**最小可行实现（MVP）**路径：

### MVP 阶段 1：基础语义记忆
1. **存储**：直接用你已有的 `stage-4-rag` 中的方案（text-embedding-v3 + 向量存储）
2. **提取**：简化为单条 LLM 调用，提取事实列表（`json_object` 模式）
3. **召回**：基于你已有的 RAG 管道，添加 `user_id` / `agent_id` 过滤
4. **作用域**：先实现 `thread` scope（单线程隔离）

### MVP 阶段 2：加入 Working Memory
1. **格式**：先用 Markdown 模式（简单直观）
2. **工具**：实现 `updateWorkingMemoryTool`（参考 Mastra 的 deepMergeWorkingMemory）
3. **注入**：在系统消息中注入 Working Memory 内容（参考 `getSystemMessage()`）

### MVP 阶段 3：Observational Memory（可选，高级）
1. **简化版 Observer**：单条 LLM 调用，从对话提取结构化观察结果
2. **时间锚定**：参考 Mastra 的 `buildMessageRange()` 和日期解析
3. **简化版 Reflector**：当观察结果超过阈值时，压缩为摘要
4. **异步缓冲**：先实现同步模式，后续再加异步

### 关键可复用代码模式
- **嵌入缓存**：`xxhash` + Map 缓存，避免重复嵌入
- **分块策略**：按词边界分块，避免截断（参考 `chunkText()`）
- **互斥锁**：`async-mutex` 防止并发更新竞态
- **模型路由**：根据输入 token 数选模型（参考 `ModelByInputTokens`）
- **时间锚定**：相对时间 → 绝对日期（参考 Observer Agent 提示词）
