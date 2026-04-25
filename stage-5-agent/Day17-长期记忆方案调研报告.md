# Day 17 调研报告：Agent 长期记忆存储方案对比

> 调研日期：2026-04-22  
> 调研范围：适合 TypeScript/Node.js 生态的 Agent 长期记忆存储方案  
> 约束：基于可验证信息，优先推荐有官方文档/开源仓库的方案

---

## 一、方案总览对比

| 方案 | 核心依赖 | 持久化 | 向量检索 | 免费额度 | 学习曲线 | 推荐度 |
|------|---------|--------|---------|---------|---------|--------|
| **内存数组 + JSON** | 无 | 手动序列化 | 内存计算 | 无限 | 极低 | ⭐⭐ 入门 |
| **SQLite + 手动相似度** | `better-sqlite3` | ✅ 自动 | JS 计算余弦相似度 | 无限 | 中 | ⭐⭐⭐⭐⭐ **学习首选** |
| **Upstash Vector** | HTTP API | ✅ 自动 | 服务端向量检索 | 10K 请求/天 | 低 | ⭐⭐⭐⭐ **进阶推荐** |
| **PostgreSQL + pgvector** | `pg` + 插件 | ✅ 自动 | 数据库内置 | 需自建 | 高 | ⭐⭐⭐ 生产级 |
| **LanceDB** | `@lancedb/lancedb` | ✅ 自动 | 内置 ANN 搜索 | 无限 | 中 | ⭐⭐⭐ 本地应用 |
| **Chroma** | `chromadb` | ✅ 自动 | 内置向量检索 | 无限 | 中 | ⭐⭐ Python 生态更强 |
| **mem0** | `mem0ai` | ✅ 自动 | 混合检索 | 有限免费 | 低 | ⭐⭐⭐ 框架级抽象 |

> ⚠️ **排除说明**：
> - Pinecone / Weaviate / Milvus：无免费额度或学习成本过高，不推荐用于学习
> - USearch：Node.js 绑定文档不完整，暂不推荐
> - Faiss：Python 生态为主，Node.js 绑定非官方

---

## 二、核心概念回顾

### 长期记忆的关键问题

```
┌─────────────────────────────────────────────────────────────┐
│                    长期记忆生命周期                          │
├─────────────────────────────────────────────────────────────┤
│  写入 → 存储 → 检索 → 更新 → 过期 → 去重                    │
│   ↓      ↓      ↓      ↓      ↓      ↓                     │
│  从对话   持久化  向量相似  修改已  TTL   语义去重           │
│  提取关键 到磁盘  度搜索  有记忆  机制  （不存重复内容）       │
│  信息                                                       │
└─────────────────────────────────────────────────────────────┘
```

### 向量记忆的核心流程

```
1. 提取：从对话中识别"值得记住"的信息
2. 嵌入：用 Embedding 模型将文本转为向量
3. 存储：将 {文本, 向量, 时间戳, 元数据} 存入数据库
4. 检索：用户提问时，将问题转为向量，计算相似度，返回 Top-K
5. 注入：将检索到的记忆拼入 System Prompt
```

---

## 三、数据库生态与选型深度对比

> 本节从生态成熟度、Node.js/TypeScript 支持、运维成本、数据控制四个维度，对适合 Agent 长期记忆的存储方案进行深度对比。信息基于各项目的官方仓库、npm 生态数据及实际接入经验。

---

### 3.1 分类总览

根据存储架构，可将这些方案分为四类：

| 分类 | 代表方案 | 核心特征 |
|------|---------|---------|
| **关系型+扩展** | SQLite, PostgreSQL + pgvector | 结构化数据 + 向量检索，ACID 完备 |
| **Serverless 托管** | Upstash Vector | 零运维，HTTP API，按量计费 |
| **嵌入式向量库** | LanceDB, USearch | 本地文件存储，进程内调用，低延迟 |
| **框架抽象层** | mem0 | 多后端适配，关注业务层，隐藏存储细节 |

---

### 3.2 各方案生态详解

#### ① SQLite — 前端开发者最熟悉的数据库

| 维度 | 详情 |
|------|------|
| **Node.js 生态** | `better-sqlite3`（同步，高性能，npm 周下载量 200万+）；`sqlite3`（异步，官方绑定） |
| **TypeScript 支持** | ✅ 完善，有官方类型定义 |
| **向量能力** | ❌ 无原生向量索引，需手动计算相似度或外挂 USearch |
| **运维成本** | 零（单文件，无需服务） |
| **数据控制** | 完全本地，文件级备份 |

**生态优势**：SQLite 是前端开发者最容易上手的数据库。`better-sqlite3` 在 Node.js 生态中性能极佳，API 简洁直观。对于 Agent 记忆场景，SQLite 负责结构化元数据存储（内容、时间戳、作用域），向量检索可通过 JS 计算或外挂索引实现。

**实际局限**：当记忆数量超过 1 万条时，全表扫描+JS 计算余弦相似度的性能会明显下降。此时需要引入 ANN（近似最近邻）索引（如 USearch）来加速。

---

#### ② PostgreSQL + pgvector — 生产级首选

| 维度 | 详情 |
|------|------|
| **Node.js 生态** | `pg` 驱动成熟（npm 周下载量 500万+）；`drizzle-orm` / `prisma` 提供类型安全的数据库操作 |
| **TypeScript 支持** | ✅ 极佳，ORM 层提供完整类型推断 |
| **向量能力** | ✅ `pgvector` 扩展提供 `vector` 类型 + IVFFlat/HNSW 索引，支持余弦/欧氏/内积相似度 |
| **运维成本** | 中高（需安装 PG，配置扩展，备份策略） |
| **数据控制** | 完全自有，可本地可云端 |

**生态优势**：pgvector 是目前生产环境使用最广泛的向量扩展，与 PostgreSQL 的成熟生态无缝结合。对于需要同时存储关系型数据（用户表、对话历史）和向量数据的场景，这是"一套数据库搞定所有"的方案。

**前端开发者适配度**：如果你已经熟悉 SQL，上手难度中等。但如果从未接触过 PostgreSQL，安装、权限、备份等运维知识会带来额外学习成本。

---

#### ③ Upstash Vector — Serverless 无运维方案

| 维度 | 详情 |
|------|------|
| **Node.js 生态** | `@upstash/vector` SDK 官方维护，REST API 设计简洁 |
| **TypeScript 支持** | ✅ 官方 SDK 自带类型定义 |
| **向量能力** | ✅ 内置余弦相似度搜索，自动管理索引 |
| **运维成本** | 零（托管服务） |
| **数据控制** | 数据存储在 Upstash 云端 |

**生态优势**：对前端开发者最友好的"一键向量数据库"。不需要安装任何软件，注册账号即可获得一个可通过 HTTP 访问的向量索引。免费额度（10K 请求/天）对学习和小型原型完全够用。

**实际局限**：数据存储在第三方云端，敏感信息需要加密后存储；免费额度用完后需要付费；无法离线使用。

---

#### ④ LanceDB — 本地嵌入式向量数据库

| 维度 | 详情 |
|------|------|
| **Node.js 生态** | `@lancedb/lancedb` 官方维护，基于 Rust 核心 |
| **TypeScript 支持** | ✅ 有类型定义，但 Node.js 文档相对 Python 较少 |
| **向量能力** | ✅ 内置 ANN 搜索（基于 Rust 实现），支持向量+全文混合查询 |
| **运维成本** | 零（本地文件） |
| **数据控制** | 完全本地 |

**生态优势**：LanceDB 的亮点是存储格式（Lance）专为机器学习工作负载设计，支持零拷贝读取。对于需要在本地处理大量向量数据（如文档嵌入）的场景，性能表现出色。

**前端开发者适配度**：Node.js 绑定可用，但生态和社区资源明显偏向 Python。如果项目以 Python 后端为主，这是极佳选择；纯 Node.js 项目可用，但遇到问题可参考的资料较少。

---

#### ⑤ Chroma — Python 生态更强的向量数据库

| 维度 | 详情 |
|------|------|
| **Node.js 生态** | `chromadb` 有 Node.js 客户端，但服务端本身需 Python 运行 |
| **TypeScript 支持** | ⚠️ 客户端有类型，但服务端依赖 Python |
| **向量能力** | ✅ 专为向量检索设计，支持多种嵌入模型集成 |
| **运维成本** | 低（可嵌入式运行，但核心为 Python） |
| **数据控制** | 本地或自托管 |

**生态优势**：Chroma 在 Python AI 生态中非常流行，与 LangChain、LlamaIndex 等框架集成良好。

**前端开发者适配度**：⚠️ **不推荐作为纯 Node.js 项目的首选**。虽然可以通过 HTTP 客户端调用，但部署和运维需要处理 Python 环境。如果你的项目已经是 Python + Node.js 混合架构，可以考虑。

---

#### ⑥ USearch — 高性能 ANN 索引库

| 维度 | 详情 |
|------|------|
| **Node.js 生态** | `usearch` npm 包存在，但 Node.js 专用文档较少 |
| **TypeScript 支持** | ⚠️ 有基本类型，但示例和文档不足 |
| **向量能力** | ✅ 核心为 C++ 实现的 ANN 搜索，性能极高 |
| **运维成本** | 零（嵌入式） |
| **数据控制** | 完全本地，单文件索引 |

**生态优势**：USearch 的定位是"最快的向量搜索库之一"，核心用 C++ 编写，提供多语言绑定。单文件索引使其非常适合与 SQLite 组合使用（SQLite 存元数据，USearch 存向量索引）。

**前端开发者适配度**：⚠️ **当前暂不推荐单独使用**。Node.js 绑定的文档和示例不够完善，且 API 可能不稳定。但在路线图和学习计划中提到它，是因为"SQLite + USearch"组合是一个有潜力的本地向量存储方案，待生态更成熟后可作为高性能选项。

---

#### ⑦ mem0 — 框架级记忆抽象

| 维度 | 详情 |
|------|------|
| **Node.js 生态** | `mem0ai` 官方 SDK，支持多种后端（PG, Qdrant, Chroma 等） |
| **TypeScript 支持** | ✅ 官方 SDK 提供类型定义 |
| **向量能力** | ✅ 混合检索（向量 + 关键词），自动去重和过期管理 |
| **运维成本** | 低（框架层抽象，后端可换） |
| **数据控制** | 取决于所选后端 |

**生态优势**：mem0 不是数据库，而是"记忆的框架抽象"。它帮你处理了记忆提取、存储、检索、去重、过期的完整流程。如果你想最快地实现一个带记忆的 Agent，这是最高效的方案。

**前端开发者适配度**：适合快速原型，但隐藏了底层原理。对于学习目的，建议先理解 SQLite/向量检索的底层实现，再用 mem0 提升开发效率。

---

### 3.3 Node.js/TypeScript 生态契合度排名

> 针对前端开发者视角，仅考虑 Node.js 原生支持的成熟度和资料丰富度

| 排名 | 方案 | 生态契合度 | 理由 |
|------|------|-----------|------|
| 1 | **SQLite** | ⭐⭐⭐⭐⭐ | `better-sqlite3` 成熟稳定，资料最多，前端最熟悉 |
| 2 | **Upstash Vector** | ⭐⭐⭐⭐⭐ | 纯 HTTP API，SDK 完善，与前端技术栈零摩擦 |
| 3 | **PostgreSQL + pgvector** | ⭐⭐⭐⭐ | `pg` 驱动 + ORM 成熟，但需要 PG 运维知识 |
| 4 | **mem0** | ⭐⭐⭐⭐ | SDK 完善，但框架层抽象不利于学习原理 |
| 5 | **LanceDB** | ⭐⭐⭐ | Node.js 绑定可用，但文档和社区弱于 Python |
| 6 | **Chroma** | ⭐⭐ | 需要 Python 服务端，Node.js 仅为客户端 |
| 7 | **USearch** | ⭐⭐ | Node.js 绑定文档不足，暂不推荐独立使用 |

---

### 3.4 选型决策树

```
你是前端开发者，想为 Agent 选长期记忆数据库？

├─ 是否需要理解底层原理（学习目的）？
│  └─ 是 → SQLite + 手动余弦相似度 ✅
│  └─ 否 → 继续往下
│
├─ 是否要求零安装、零运维？
│  └─ 是 → Upstash Vector ✅
│  └─ 否 → 继续往下
│
├─ 是否需要同时存大量关系型数据（用户/对话/文档）？
│  └─ 是 → PostgreSQL + pgvector ✅
│  └─ 否 → 继续往下
│
├─ 是否追求极致本地性能（>10万条向量）？
│  └─ 是 → LanceDB 或 未来考虑 SQLite + USearch ✅
│  └─ 否 → SQLite 足够 ✅
│
└─ 是否想最快实现，不关心底层？
   └─ 是 → mem0 ✅
```

---

### 3.5 与学习计划的对应关系

| 学习阶段 | 推荐方案 | 理由 |
|---------|---------|------|
| **阶段五（Day 17）** | SQLite + 手动计算 | 理解向量检索原理，零额外依赖 |
| **阶段四（Day 11）** | Upstash Vector / pgvector | 体验生产级向量存储，用于 RAG |
| **阶段七（Day 23+）** | SQLite + USearch（或 SQLite 足矣） | 综合项目，本地优先，避免外部依赖 |
| **生产部署** | PostgreSQL + pgvector 或 Upstash | 性能、可靠性、可扩展性 |

> 💡 **关于阶段七的说明**：学习计划中提到的 "SQLite + USearch" 是面向未来的高性能本地组合。以当前（2026-04）USearch 的 Node.js 生态成熟度，建议先用 SQLite + 手动相似度完成 MVP，后续再迁移到 USearch 索引加速。

---

## 四、方案一：SQLite + 手动余弦相似度（学习首选）

### 为什么选这个方案？

| 优势 | 说明 |
|------|------|
| 零额外依赖 | 只需 `better-sqlite3`，无需安装 PostgreSQL 或向量数据库 |
| 完全可控 | 自己写 SQL 和相似度计算，理解每一行代码 |
| 跨会话持久化 | SQLite 是文件数据库，重启后数据仍在 |
| 适合学习 | 不隐藏底层原理，向量检索怎么工作的自己实现 |

### 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                  SQLite 向量记忆架构                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│  │  对话内容    │ → │  Embedding  │ → │  SQLite 存储     │  │
│  │  (文本)      │    │  (向量)      │    │  (文本+向量+时间) │  │
│  └─────────────┘    └─────────────┘    └─────────────────┘  │
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│  │  用户提问    │ → │  Embedding  │ → │  余弦相似度计算   │  │
│  │  (文本)      │    │  (向量)      │    │  (JS 实现)       │  │
│  └─────────────┘    └─────────────┘    └─────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 数据库 Schema

```sql
CREATE TABLE memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,           -- 记忆文本内容
  embedding BLOB NOT NULL,         -- 向量数据（JSON 字符串存储）
  scope TEXT DEFAULT 'global',     -- 作用域：global / project / user
  project_path TEXT,               -- 关联项目路径
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- 索引加速时间范围查询
CREATE INDEX idx_memories_created ON memories(created_at);
CREATE INDEX idx_memories_scope ON memories(scope);
```

### 核心代码设计

```typescript
/**
 * SQLite 向量记忆管理器
 * 使用 better-sqlite3 + 手动余弦相似度计算
 */

import Database from 'better-sqlite3';
import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';

interface Memory {
  id: number;
  content: string;
  embedding: number[];
  scope: string;
  createdAt: number;
}

class VectorMemoryManager {
  private db: Database.Database;

  constructor(dbPath: string = './data/memories.db') {
    this.db = new Database(dbPath);
    this.initTable();
  }

  private initTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        embedding TEXT NOT NULL,
        scope TEXT DEFAULT 'global',
        project_path TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );
      CREATE INDEX IF NOT EXISTS idx_memories_scope ON memories(scope);
    `);
  }

  /**
   * 添加记忆
   */
  async addMemory(content: string, scope: string = 'global'): Promise<void> {
    const { embedding } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: content,
    });

    const stmt = this.db.prepare(
      'INSERT INTO memories (content, embedding, scope) VALUES (?, ?, ?)'
    );
    stmt.run(content, JSON.stringify(embedding), scope);
  }

  /**
   * 向量搜索：计算余弦相似度返回 Top-K
   */
  async searchMemories(
    query: string,
    topK: number = 5,
    scope?: string
  ): Promise<Array<{ content: string; similarity: number }>> {
    // 1. 生成查询向量
    const { embedding: queryEmbedding } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: query,
    });

    // 2. 加载候选记忆（可按 scope 过滤）
    let sql = 'SELECT content, embedding FROM memories';
    let params: string[] = [];
    if (scope) {
      sql += ' WHERE scope = ?';
      params.push(scope);
    }

    const rows = this.db.prepare(sql).all(...params) as Array<{
      content: string;
      embedding: string;
    }>;

    // 3. 计算余弦相似度并排序
    const results = rows.map(row => ({
      content: row.content,
      similarity: cosineSimilarity(
        queryEmbedding,
        JSON.parse(row.embedding)
      ),
    }));

    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  /**
   * 记忆去重：检查语义相似的内容是否已存在
   */
  async isDuplicate(content: string, threshold: number = 0.95): Promise<boolean> {
    const results = await this.searchMemories(content, 1);
    return results.length > 0 && results[0].similarity > threshold;
  }

  /**
   * 清理过期记忆（TTL 机制）
   */
  cleanupExpired(ttlDays: number = 30): void {
    const cutoff = Date.now() / 1000 - ttlDays * 24 * 3600;
    this.db.prepare('DELETE FROM memories WHERE created_at < ?').run(cutoff);
  }
}

/**
 * 余弦相似度计算
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

### 使用流程

```typescript
const memory = new VectorMemoryManager();

// 1. 添加记忆
await memory.addMemory('用户喜欢 TypeScript，讨厌 Python', 'user-preferences');
await memory.addMemory('项目名称是 AI Learning Plan', 'project-context');

// 2. 检索记忆
const results = await memory.searchMemories('用户偏好什么语言？', 3);
// → [{ content: '用户喜欢 TypeScript...', similarity: 0.89 }, ...]

// 3. 注入 System Prompt
const systemPrompt = `你是 AI 助手。相关背景：${results.map(r => r.content).join('\n')}`;
```

### 优点与局限

| 优点 | 局限 |
|------|------|
| 零额外服务依赖 | 大数据量时全表扫描慢 |
| 完全理解原理 | 没有 ANN 加速（如 HNSW） |
| 文件级便携 | 高并发写入性能一般 |
| 适合学习和小项目 | 不适合百万级向量 |

---

## 五、方案二：Upstash Vector（进阶推荐）

### 为什么选这个方案？

| 优势 | 说明 |
|------|------|
| Serverless | 无需安装任何数据库，HTTP API 调用 |
| 免费额度 | 每日 10K 请求，适合学习和原型 |
| 原生向量检索 | 内置余弦相似度，不需要自己计算 |
| 持久化 | 云端存储，跨设备可用 |

### 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                  Upstash Vector 架构                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│  │  对话内容    │ → │  Embedding  │ → │  Upstash Vector │  │
│  │  (文本)      │    │  (阿里云)    │    │  (HTTP API)      │  │
│  └─────────────┘    └─────────────┘    └─────────────────┘  │
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│  │  用户提问    │ → │  Embedding  │ → │  Upstash Query  │  │
│  │  (文本)      │    │  (阿里云)    │    │  (相似度搜索)    │  │
│  └─────────────┘    └─────────────┘    └─────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 核心代码设计

```typescript
/**
 * Upstash Vector 记忆管理器
 * Serverless 向量数据库，HTTP API 调用
 */

interface UpstashVectorClient {
  upsert(vectors: Array<{
    id: string;
    vector: number[];
    metadata: Record<string, any>;
  }>): Promise<void>;

  query(vector: number[], options: {
    topK: number;
    includeMetadata: boolean;
  }): Promise<Array<{
    id: string;
    score: number;
    metadata: Record<string, any>;
  }>>;
}

class UpstashMemoryManager {
  private client: UpstashVectorClient;

  constructor(url: string, token: string) {
    // 使用 @upstash/vector SDK
    this.client = new VectorClient({ url, token });
  }

  /**
   * 添加记忆
   */
  async addMemory(content: string, scope: string = 'global'): Promise<void> {
    const { embedding } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: content,
    });

    await this.client.upsert([{
      id: `mem_${Date.now()}`,
      vector: embedding,
      metadata: {
        content,
        scope,
        createdAt: Date.now(),
      },
    }]);
  }

  /**
   * 检索记忆
   */
  async searchMemories(
    query: string,
    topK: number = 5
  ): Promise<Array<{ content: string; score: number }>> {
    const { embedding } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: query,
    });

    const results = await this.client.query(embedding, {
      topK,
      includeMetadata: true,
    });

    return results.map(r => ({
      content: r.metadata.content,
      score: r.score,
    }));
  }
}
```

### 配置方式

```bash
# .env
UPSTASH_VECTOR_REST_URL="https://your-index.upstash.io"
UPSTASH_VECTOR_REST_TOKEN="your-token"
```

```bash
# 安装 SDK
pnpm add @upstash/vector
```

### 优点与局限

| 优点 | 局限 |
|------|------|
| 零运维，Serverless | 需要网络连接 |
| 原生向量搜索 | 免费额度有限（10K/天） |
| 支持 metadata 过滤 | 数据在云端，敏感数据需注意 |
| 适合原型和轻量应用 | 超量后需付费 |

---

## 六、方案对比总结

| 维度 | SQLite + 手动计算 | Upstash Vector |
|------|------------------|----------------|
| **学习价值** | ⭐⭐⭐⭐⭐（理解底层） | ⭐⭐⭐（关注应用层） |
| **部署复杂度** | 极低（一个 npm 包） | 低（注册账号即可） |
| **性能** | 中（< 1万条时够用） | 高（原生向量索引） |
| **持久化** | 本地文件 | 云端 |
| **跨设备** | 需同步文件 | 自动同步 |
| **最佳场景** | 学习、本地工具、小项目 | 原型、Serverless 应用 |

---

## 七、学习建议路线

### 第一阶段：SQLite 方案（1-2 天）

目标：理解向量记忆的完整实现原理

1. 实现 `VectorMemoryManager` 类（增删查）
2. 实现余弦相似度计算
3. 实现记忆去重（语义相似度阈值判断）
4. 实现 TTL 清理机制
5. 测试：添加 10 条记忆 → 重启程序 → 检索是否仍能找到

### 第二阶段：Upstash 方案（0.5-1 天）

目标：体验生产级向量数据库的便利性

1. 注册 Upstash 账号，创建 Vector Index
2. 用 SDK 实现同样的增删查接口
3. 对比两个方案的代码量和性能差异

---

## 八、参考资源

| 资源 | 说明 | 可访问性 |
|------|------|---------|
| better-sqlite3 文档 | 最快的 SQLite Node.js 驱动 | ✅ npm 包自带 |
| Upstash Vector 文档 | Serverless 向量数据库 | ✅ https://upstash.com/docs/vector |
| pgvector GitHub | PostgreSQL 向量扩展 | ✅ https://github.com/pgvector/pgvector |
| LanceDB 文档 | 嵌入式向量数据库 | ✅ https://lancedb.github.io/lancedb/ |
| mem0 文档 | 框架级记忆抽象 | ✅ https://docs.mem0.ai/ |
| USearch GitHub | 高性能 ANN 搜索库 | ✅ https://github.com/unum-cloud/usearch |
| Vercel AI SDK Embeddings | Embedding 生成文档 | ✅ https://sdk.vercel.ai/docs/ai-sdk-core/embeddings |
| 阿里云 text-embedding-v3 | 用户当前使用的 Embedding 模型 | ✅ 阿里云控制台 |

---

> **调研结论**：
> - **学习首选**：SQLite + 手动余弦相似度（完全可控，理解原理）
> - **进阶体验**：Upstash Vector（感受生产级向量数据库的便利）
> - **生产部署**：PostgreSQL + pgvector（关系型+向量一体，ACID 完备）
> - **快速实现**：mem0（框架级抽象，最快上线）
> - 前端开发者应优先选择 Node.js 生态成熟的方案（SQLite、Upstash），避开需要 Python 环境的 Chroma 和文档不完整的 USearch（独立使用）
