# 第 25 章：知识管理系统与 RAG 整合

> 本章目标：把 LLM Wiki 和 RAG 结合起来，构建"知识积累 → 编译 → 检索 → 问答"的完整闭环。
> 对应学习计划：Day 36-37
> 🚧 本章为整合指导，具体实现基于前面所有章节的知识积累。

---

## 概念速览

### 完整的知识管理闭环

```
┌─────────────────────────────────────────────────────┐
│                                                      │
│  日常输入                                            │
│  ├── 技术文章（Web Clipper 剪藏）                    │
│  ├── 学习笔记（手动编写）                            │
│  ├── 代码片段（从项目中提取）                        │
│  └── 对话记录（与 AI 的重要对话）                    │
│              │                                       │
│              ▼                                       │
│  raw/（原始素材目录）                                │
│              │                                       │
│              ▼  LLM 编译（第 24 章）                 │
│  wiki/（结构化知识库）                               │
│  ├── concepts/（概念页面）                           │
│  ├── patterns/（设计模式）                           │
│  └── index.md（总索引）                              │
│              │                                       │
│              ▼  Embedding + 向量化（第 7-8 章）      │
│  向量索引（Wiki 页面的 Embedding）                   │
│              │                                       │
│              ▼  RAG 检索（第 9 章）                  │
│  智能问答（基于 Wiki 内容回答问题）                   │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### 为什么要整合 LLM Wiki + RAG

单独用 LLM Wiki：可以浏览 Wiki 页面，但不能用自然语言提问。
单独用 RAG：可以提问，但检索的是原始文档碎片，质量参差不齐。

整合后：**RAG 检索的是 LLM 编译过的高质量 Wiki 页面**，回答质量显著提升。

```
对比：
  RAG on raw docs:    "什么是 Embedding？" → 检索到 3 个文档碎片 → 拼凑回答（可能不完整）
  RAG on Wiki pages:  "什么是 Embedding？" → 检索到 wiki/concepts/embedding.md → 回答准确完整
```

---

## 技术选型

### 整合架构

```
方案：Wiki 页面作为 RAG 知识源

1. 编译阶段（离线）
   raw/ 文档 → llmwiki compile → wiki/ 页面

2. 索引阶段（离线或按需）
   wiki/ 页面 → 分块 → embedMany → 向量索引（JSON 文件）

3. 查询阶段（在线）
   用户问题 → embed → 搜索向量索引 → 取 Top-K Wiki 片段 → LLM 生成回答

核心复用：
  第 8 章的分块策略
  第 9 章的 RAG 管道
  第 24 章的 Wiki 编译
```

### 增量更新策略

```
问题：每次新增文档都要全量重新编译 + 重新索引吗？
答案：不用。增量更新分两步：

1. 增量编译：只对新增/修改的 raw/ 文件运行编译
   → 记录每个文件的最后编译时间
   → 只处理时间戳更新的文件

2. 增量索引：只对新增/修改的 wiki/ 页面重新 Embedding
   → 记录每个 Wiki 页面的 hash
   → hash 变化的才重新 Embedding
```

---

## 代码骨架

### 1. Wiki 页面索引器

思路：读取 wiki/ 目录中的所有 Markdown 文件，分块后做 Embedding，保存为向量索引。复用第 8 章的分块逻辑。

```typescript
// wiki-indexer.ts — 对 Wiki 页面建立向量索引
import { embedMany } from 'ai'
import { qwen } from 'shared-utils'
import { readFileSync, writeFileSync, readdirSync } from 'fs'

interface WikiChunk {
  pageTitle: string       // Wiki 页面标题
  content: string         // 分块内容
  source: string          // 来源文件路径
  embedding: number[]     // 向量
}

// 思路：读取 wiki/concepts/ 下的所有 Markdown 文件
function loadWikiPages(wikiDir: string): Array<{ title: string; content: string; path: string }> {
  const files = readdirSync(wikiDir).filter(f => f.endsWith('.md'))
  return files.map(f => {
    const content = readFileSync(`${wikiDir}/${f}`, 'utf-8')
    // 思路：用第一行的 # 标题作为页面标题
    const title = content.match(/^#\s+(.+)/m)?.[1] ?? f.replace('.md', '')
    return { title, content, path: `${wikiDir}/${f}` }
  })
}

// 思路：复用第 8 章的分块逻辑，但 Wiki 页面通常已经很结构化，可以按 ## 分块
function chunkWikiPage(page: { title: string; content: string; path: string }): Array<Omit<WikiChunk, 'embedding'>> {
  const sections = page.content.split(/(?=^##\s)/m).filter(s => s.trim())
  return sections.map(section => ({
    pageTitle: page.title,
    content: section.trim(),
    source: page.path,
  }))
}

// 思路：对所有分块做 Embedding，保存为 JSON 索引文件
async function buildWikiIndex(wikiDir: string, outputPath: string) {
  const pages = loadWikiPages(wikiDir)
  console.log(`找到 ${pages.length} 个 Wiki 页面`)

  const allChunks = pages.flatMap(p => chunkWikiPage(p))
  console.log(`分块后共 ${allChunks.length} 个片段`)

  // 思路：批量 Embedding（第 7 章的 embedMany）
  const { embeddings } = await embedMany({
    model: qwen.textEmbeddingModel('text-embedding-v3'),
    values: allChunks.map(c => c.content),
  })

  const indexedChunks: WikiChunk[] = allChunks.map((chunk, i) => ({
    ...chunk,
    embedding: embeddings[i],
  }))

  writeFileSync(outputPath, JSON.stringify(indexedChunks, null, 2))
  console.log(`索引已保存到 ${outputPath}`)
}

await buildWikiIndex('./wiki/concepts', './wiki-index.json')
```

### 2. Wiki RAG 查询

思路：复用第 9 章的 RAG 管道，只是数据源从"原始文档分块"变成了"Wiki 页面分块"。

```typescript
// wiki-query.ts — 基于 Wiki 的 RAG 问答
import { embed, generateText } from 'ai'
import { qwen } from 'shared-utils'
import { readFileSync } from 'fs'

// 思路：加载索引文件（和第 9 章一样）
const wikiIndex: WikiChunk[] = JSON.parse(
  readFileSync('./wiki-index.json', 'utf-8')
)

// 思路：余弦相似度（和第 7 章一样）
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

async function queryWiki(question: string): Promise<string> {
  // 1. 把问题转成向量
  const { embedding: queryEmb } = await embed({
    model: qwen.textEmbeddingModel('text-embedding-v3'),
    value: question,
  })

  // 2. 搜索最相关的 Wiki 片段
  const scored = wikiIndex
    .map(chunk => ({ ...chunk, score: cosineSimilarity(queryEmb, chunk.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3) // Top-3

  console.log('检索到的 Wiki 片段：')
  scored.forEach(s => console.log(`  [${s.score.toFixed(3)}] ${s.pageTitle}`))

  // 3. 拼入上下文，生成回答
  const context = scored
    .map(s => `### ${s.pageTitle}\n${s.content}`)
    .join('\n\n---\n\n')

  // 思路：和第 9 章的 RAG 管道一样，只是上下文来源变成了 Wiki 页面
  const result = await generateText({
    model: qwen('qwen-turbo'),
    system: `你是一个知识库助手。基于以下 Wiki 页面内容回答用户问题。
如果 Wiki 中没有相关信息，请明确告知。

${context}`,
    prompt: question,
  })

  return result.text
}

// 使用
const answer = await queryWiki('Embedding 和 RAG 是什么关系？')
console.log(answer)
```

### 3. 增量更新脚本

思路：记录每个文件的 hash，只对变化的文件重新编译和索引。

```typescript
// incremental-update.ts — 增量更新思路
import { createHash } from 'crypto'
import { readFileSync, writeFileSync, existsSync } from 'fs'

interface FileHash {
  [filepath: string]: string
}

function getFileHash(filepath: string): string {
  const content = readFileSync(filepath, 'utf-8')
  return createHash('md5').update(content).digest('hex')
}

// 思路：对比当前文件 hash 和上次记录的 hash，找出变化的文件
function findChangedFiles(dir: string, hashFile: string): string[] {
  const currentHashes: FileHash = {}
  // ... 遍历 dir 中的所有 .md 文件，计算 hash

  const previousHashes: FileHash = existsSync(hashFile)
    ? JSON.parse(readFileSync(hashFile, 'utf-8'))
    : {}

  const changed: string[] = []
  for (const [path, hash] of Object.entries(currentHashes)) {
    if (previousHashes[path] !== hash) {
      changed.push(path)
    }
  }

  // 思路：更新 hash 记录
  writeFileSync(hashFile, JSON.stringify(currentHashes, null, 2))
  return changed
}

// 使用思路：
// 1. const changedRawFiles = findChangedFiles('./raw', '.raw-hashes.json')
// 2. 只对 changedRawFiles 运行 LLM 编译
// 3. const changedWikiFiles = findChangedFiles('./wiki', '.wiki-hashes.json')
// 4. 只对 changedWikiFiles 重新 Embedding
```

---

## 实战建议（Day 36-37 任务指南）

### Day 36：构建知识管理系统

```
任务清单：
1. 设计你的知识分类体系
   → 前端视角的分类：框架/工具/设计模式/API/踩坑记录
   → 还是按学习阶段分：LLM基础/Chat开发/RAG/Agent/MCP
   → 没有标准答案，选一个你用着舒服的

2. 收集 5-10 篇原始素材放入 raw/
   → 学习计划的知识总结（知识总结/目录下的文件）
   → 你自己写的学习笔记
   → 有价值的技术文章（用 Obsidian Web Clipper 剪藏）

3. 运行编译流程，查看 LLM 如何组织知识
   → 用 llmwiki compile 或 mini-wiki-compiler.ts
   → 在 Obsidian 中浏览生成的 Wiki 页面
   → Graph View 看看知识图谱长什么样

4. 手动编辑 Wiki 页面
   → 修正 LLM 提取有误的概念
   → 补充 LLM 遗漏的关联
   → 体验"LLM 辅助 + 人工维护"的工作流
```

### Day 37：LLM Wiki + RAG 整合

```
任务清单：
1. 对 wiki/ 目录建立向量索引（wiki-indexer.ts）
2. 实现基于 Wiki 的 RAG 查询（wiki-query.ts）
3. 测试几个问题，对比：
   - 直接在 Obsidian 中搜索 vs RAG 查询
   - RAG on raw docs vs RAG on Wiki pages（回答质量差异）
4. 尝试增量更新：
   - 新增一篇 raw/ 文档
   - 运行编译 + 重新索引
   - 验证新内容是否可以被检索到
5. 总结：LLM Wiki 和 RAG 各适合什么场景
```

---

## 踩坑记录

⚠️ **坑 1：Wiki 编译的 Token 成本不便宜**
10 篇文档全量编译可能消耗 10 万+ Token。如果用 GPT-4 级别的模型，费用可能达到几十元。
→ **怎么绕**：先用便宜模型编译（qwen-turbo），质量够用就不用升级。增量更新避免重复编译。

⚠️ **坑 2：LLM 编译结果需要人工审查**
LLM 可能把次要细节提炼成核心概念，或者把两个不同的概念合并到一起。
→ **铁律**：编译后一定要人工过一遍。LLM Wiki 不是"全自动"，是"辅助"。

⚠️ **坑 3：Wiki 页面太多时 Graph View 会变得很密**
如果有 100+ 个概念页面，Obsidian 的 Graph View 会变成一团乱麻，看不出什么有价值的信息。
→ **怎么绕**：用标签过滤、分区展示。或者只关注某个子主题的图谱。

⚠️ **坑 4：向量索引 JSON 文件会变得很大**
每个 Embedding 是一个长向量（768-1536 维度），100 个分块的 JSON 可能有几十 MB。
→ **怎么绕**：学习阶段无所谓。如果后续量大，考虑用二进制格式（如 Float32Array 直接写文件）或嵌入式向量数据库。

---

## 练习

### 基础练习
1. 对 wiki/ 目录中的 Wiki 页面建立向量索引
2. 实现 `queryWiki` 函数，用自然语言查询 Wiki 内容

### 进阶挑战
1. 实现增量更新：只对新增/修改的文件重新编译和索引
2. 把 Wiki RAG 整合到你的 Chat 应用中：在 route.ts 中添加 Wiki 知识源

### 思考题
1. LLM Wiki 的"编译"过程和传统编程中的"编译"有什么异同？（提示：从信息转换的角度思考）
2. 如果你要长期维护一个个人知识库，LLM Wiki 工作流中最重要的环节是什么？（编译质量？人工审查？知识分类体系？增量更新？）

---

## 延伸阅读

| 资料 | 推荐理由 |
|------|---------|
| [Karpathy 关于 LLM Wiki 的推文/博客](https://karpathy.ai) | 📖 原始想法来源 |
| [llmwiki-compiler GitHub](https://github.com/nicholasgriffintn/llm-wiki-compiler) | 📖 TypeScript 实现参考 |
| [Obsidian Web Clipper](https://obsidian.md/clipper) | 📖 浏览器插件，一键剪藏网页到 Obsidian |
| 本手册第 7-9 章 | ✅ Embedding + 分块 + RAG 管道的完整实现 |
| 本手册第 24 章 | ✅ LLM Wiki 概念和编译工具 |

---

| [← 上一章：LLM Wiki 概念与工具](../chapter24/) |  |
