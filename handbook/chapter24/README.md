# 第 24 章：LLM Wiki 概念与工具

> 本章目标：理解 Karpathy 提出的 LLM Wiki 模式，掌握 Obsidian + llmwiki-compiler 的基本使用。
> 对应学习计划：Day 34-35
> 🚧 LLM Wiki 是一个较新的概念，工具生态尚在早期阶段，本章侧重理解思想和动手体验。

---

## 概念速览

### 什么是 LLM Wiki

Andrej Karpathy（OpenAI 联合创始人、前特斯拉 AI 总监）提出的知识管理模式：

```
传统笔记：人写笔记，人整理，人检索
RAG 模式：文档 → 切块 → Embedding → 每次查询从原始文档检索
LLM Wiki：文档 → LLM 增量编译 → 持久化 Wiki → 查询已编译的知识
```

核心差异：RAG 每次查询都从**原始文档碎片**中检索拼凑答案；LLM Wiki 让 LLM 预先消化文档，生成**结构化的 Wiki 页面**，查询时直接从 Wiki 中找答案。

### 三层架构

```
Raw Sources（原始素材）
  │  技术文章、论文笔记、代码片段、学习笔记...
  │  格式杂乱，不成体系
  ▼
Compilation（编译层）
  │  LLM 读取原始素材
  │  提取概念、建立关联、生成结构化页面
  │  增量更新：新素材只编译增量部分
  ▼
Wiki（知识库）
  │  概念页面（react-hooks.md, embedding.md, ...）
  │  双向链接（[[react-hooks]] ↔ [[useState]]）
  │  索引页（index.md — 所有概念的导航）
  └  可在 Obsidian 中浏览和编辑
```

### LLM Wiki vs RAG：不是替代，是互补

| 维度 | RAG（第 7-9 章） | LLM Wiki |
|------|-----------------|----------|
| 知识来源 | 原始文档碎片 | 已编译的结构化 Wiki 页面 |
| 查询时 | 实时检索 + LLM 拼答案 | 查询已整理好的知识 |
| 知识积累 | 不积累，每次从头检索 | 持久积累，跨会话复用 |
| 知识质量 | 取决于文档碎片的质量 | LLM 整理过，质量更高 |
| 适合 | 大规模文档库、企业知识库 | 个人知识管理、学习笔记 |
| 缺点 | 碎片化，可能检索到不相关内容 | 编译成本高，依赖 LLM 质量 |

**最佳实践**：用 LLM Wiki 积累和整理知识，用 RAG 检索 Wiki 页面（第 25 章会讲这个整合）。

---

## 技术选型

### Obsidian — 本地知识库工具

| 特性 | 说明 |
|------|------|
| 本地存储 | 所有数据都在你的本地文件系统，纯 Markdown |
| 双向链接 | `[[page-name]]` 语法，页面之间互相引用 |
| Graph View | 可视化知识图谱，看到概念之间的关联 |
| 插件生态 | 丰富的社区插件（Web Clipper、Git 同步等） |
| 免费 | 核心功能完全免费 |

**为什么用 Obsidian 而不是 Notion**：Obsidian 的数据是纯 Markdown 文件，存在本地，可以被 CLI 工具直接处理。Notion 的数据在云端，需要 API 才能读写。

### llmwiki-compiler — TypeScript LLM Wiki 工具

llmwiki-compiler 是一个 CLI 工具，实现了 LLM Wiki 的"编译"流程：

```
llmwiki init      → 初始化 Wiki 项目结构
llmwiki ingest    → 导入原始文档到 raw/ 目录
llmwiki compile   → LLM 读取 raw/ 文档，生成 wiki/ 页面
llmwiki query     → 基于 Wiki 内容回答问题
```

⚠️ 此工具需要配置 LLM API Key（支持 Anthropic/OpenAI），编译过程会消耗 Token。

---

## 代码骨架

### 1. Obsidian 项目结构

思路：按照 LLM Wiki 三层架构组织目录，raw/ 放原始素材，wiki/ 放编译结果。

```
frontend-wiki/                  ← Obsidian Vault 根目录
├── raw/                        ← 原始素材（你手动放入的学习资料）
│   ├── articles/               ← 技术文章
│   │   ├── react-hooks-guide.md
│   │   └── typescript-generics.md
│   ├── notes/                  ← 个人学习笔记
│   │   ├── day-01-llm-basics.md
│   │   └── day-10-embedding.md
│   └── snippets/               ← 代码片段
│       └── rag-pipeline.md
├── wiki/                       ← LLM 编译生成的 Wiki 页面
│   ├── concepts/               ← 概念页面（自动生成）
│   │   ├── embedding.md
│   │   ├── rag.md
│   │   └── prompt-engineering.md
│   ├── index.md                ← 总索引（自动生成）
│   └── queries/                ← 保存的问答（自动生成）
└── .wikirc.yaml                ← 配置文件
```

### 2. llmwiki CLI 使用流程

思路：按 init → ingest → compile → query 四步走。每步做什么、结果是什么，心里要有数。

```bash
# 1. 安装（全局安装 CLI 工具）
npm install -g llmwiki-compiler

# 2. 配置 API Key（llmwiki 需要 LLM 来"编译"知识）
export ANTHROPIC_API_KEY=sk-xxx
# 或
export OPENAI_API_KEY=sk-xxx

# 3. 初始化 Wiki 项目
mkdir frontend-wiki && cd frontend-wiki
llmwiki init
# 思路：会生成 raw/ 、wiki/ 目录和 .wikirc.yaml 配置文件

# 4. 导入原始文档
# 方式 A：从 URL 导入
llmwiki ingest https://example.com/article.md
# 方式 B：手动把 Markdown 文件放到 raw/ 目录

# 5. 编译 — 核心步骤
llmwiki compile
# 思路：LLM 会读取 raw/ 中的所有文档
# 提取概念 → 生成概念页面 → 建立链接 → 输出到 wiki/
# ⚠️ 这一步消耗 Token，文档越多越贵

# 6. 查询
llmwiki query "什么是 Embedding？它和 RAG 是什么关系？"
# 思路：基于 wiki/ 中的内容回答，而不是从 raw/ 重新检索
```

### 3. 手动实现最小 LLM Wiki（不依赖 CLI）

思路：如果 llmwiki-compiler 安装有问题，可以用 AI SDK 自己实现最小编译流程。核心就是：读文档 → 让 LLM 提取概念 → 写 Wiki 页面。

```typescript
// mini-wiki-compiler.ts — 最小 LLM Wiki 编译器
import { generateText, Output } from 'ai'
import { qwen } from 'shared-utils'
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'fs'
import { z } from 'zod'

// 思路：第一步 — 读取 raw/ 目录中的所有 Markdown 文件
const rawDir = './raw'
const rawFiles = readdirSync(rawDir).filter(f => f.endsWith('.md'))
const rawContents = rawFiles.map(f => ({
  filename: f,
  content: readFileSync(`${rawDir}/${f}`, 'utf-8'),
}))

// 思路：第二步 — 让 LLM 从原始文档中提取概念
const { object: concepts } = await generateText({
  model: qwen('qwen-max'),
  prompt: `以下是 ${rawFiles.length} 篇技术文档。请提取其中的核心概念，每个概念给出：名称、一句话定义、相关概念。

${rawContents.map(r => `--- ${r.filename} ---\n${r.content}`).join('\n\n')}`,
  experimental_output: Output.object({
    schema: z.object({
      concepts: z.array(z.object({
        name: z.string(),
        definition: z.string(),
        relatedConcepts: z.array(z.string()),
        sourceFiles: z.array(z.string()),
      })),
    }),
  }),
})

// 思路：第三步 — 为每个概念生成 Wiki 页面
mkdirSync('./wiki/concepts', { recursive: true })

for (const concept of concepts.concepts) {
  const wikiPage = `# ${concept.name}

${concept.definition}

## 相关概念
${concept.relatedConcepts.map(c => `- [[${c}]]`).join('\n')}

## 来源
${concept.sourceFiles.map(f => `- ${f}`).join('\n')}
`
  // 思路：文件名用 kebab-case，双向链接用 [[概念名]]
  const filename = concept.name.toLowerCase().replace(/\s+/g, '-')
  writeFileSync(`./wiki/concepts/${filename}.md`, wikiPage)
}

// 思路：第四步 — 生成总索引
const indexContent = `# Wiki 索引

${concepts.concepts.map(c => `- [[${c.name}]] — ${c.definition}`).join('\n')}
`
writeFileSync('./wiki/index.md', indexContent)

console.log(`编译完成：生成了 ${concepts.concepts.length} 个概念页面`)
```

---

## 实战建议（Day 34-35 任务指南）

### Day 34：理解 LLM Wiki + Obsidian 入门

```
任务清单：
1. 阅读 Karpathy 的 LLM Wiki 相关内容
   → 搜索 "Karpathy LLM Wiki" 或 "LLM knowledge base compilation"
   → 核心理解：为什么"编译"比"检索"更适合个人知识管理
2. 安装 Obsidian（https://obsidian.md）
3. 创建 Vault，手动建几个 Markdown 页面
4. 体验双向链接：在 page-a.md 中写 [[page-b]]，观察效果
5. 打开 Graph View，观察知识图谱
```

### Day 35：LLM Wiki CLI 工具实战

```
实现思路：
1. 安装 llmwiki-compiler（如果安装失败，用上面的 mini-wiki-compiler.ts 替代）
2. 把你之前的学习笔记（知识总结/目录下的文件）作为 raw/ 素材
3. 运行编译，观察 LLM 如何组织知识
4. 测试查询功能
5. 在 Obsidian 中打开 wiki/ 目录，浏览生成的概念页面
```

---

## 踩坑记录

⚠️ **坑 1：llmwiki-compiler 可能安装失败或行为与文档不一致**
这是一个社区早期工具，API 和行为可能随版本变化。
→ **怎么绕**：如果 CLI 不好使，直接用本章的 `mini-wiki-compiler.ts` 骨架自己实现。理解思想比工具本身更重要。

⚠️ **坑 2：编译大量文档的 Token 成本可能很高**
10 篇 3000 字的文档 → 每篇约 2000 Token → 加上输出 → 可能消耗 5-10 万 Token。
→ **怎么绕**：先用 3-5 篇短文档测试，确认效果后再扩大规模。用便宜模型（qwen-turbo）做初步编译。

⚠️ **坑 3：LLM 提取的概念可能不准确或遗漏**
LLM 不是完美的"知识编译器"，它可能把次要概念当成核心概念，或遗漏重要概念。
→ **怎么绕**：编译后**人工审查和编辑** Wiki 页面。LLM Wiki 的理念是"LLM 辅助 + 人工维护"，不是全自动。

⚠️ **坑 4：Obsidian 的 [[wikilink]] 语法在 GitHub 等平台不渲染**
双向链接是 Obsidian 的扩展语法，不是标准 Markdown。
→ **认知**：LLM Wiki 主要是给自己用的知识管理系统，不需要在 GitHub 上完美渲染。

---

## 练习

### 基础练习
1. 安装 Obsidian，创建一个 Vault，手动写 3 个互相链接的概念页面
2. 用 llmwiki-compiler 或 mini-wiki-compiler.ts 对 3 篇学习笔记进行编译

### 进阶挑战
1. 把你在这个学习计划中积累的所有知识总结（`知识总结/` 目录）作为 raw/ 素材，运行一次完整的 Wiki 编译
2. 对比编译前后的知识组织：LLM 提取的概念和你自己总结的有什么不同？哪些是你没想到的？

### 思考题
1. LLM Wiki 的"编译"过程本质上是在做什么？（提示：信息压缩 + 结构化 + 关联建立）
2. 如果你要把 LLM Wiki 集成到你的开发工作流中，你希望什么时候触发编译？（保存文件时？每天定时？手动触发？）

---

## 延伸阅读

| 资料 | 推荐理由 |
|------|---------|
| [Karpathy LLM Wiki 理念](https://karpathy.ai) | 📖 关注 Karpathy 的博客/推文了解原始想法 |
| [llmwiki-compiler](https://github.com/nicholasgriffintn/llm-wiki-compiler) | 📖 TypeScript 实现的 LLM Wiki 编译工具 |
| [Obsidian 官网](https://obsidian.md) | 📖 下载和使用指南 |
| [Obsidian Help](https://help.obsidian.md) | 📖 官方帮助文档，双向链接/Graph View 的用法 |

---

| [← 上一章：AI + 前端实战案例](../chapter23/) | [下一章：知识管理系统与 RAG 整合 →](../chapter25/) |
