# 🤖 前端开发者 AI 学习计划

> 以最低学习成本，从前端开发者过渡到 AI 应用开发者
> 
> **技术路线**：TypeScript/JavaScript 生态为主，Python 为辅  
> **核心框架**：Vercel AI SDK + Next.js  
> **更新时间**：2026-04-18

---

## 📋 项目概览

这是一个系统化的 AI 应用开发学习项目，专为前端开发者设计。从基础的 LLM API 调用到复杂的 Agent 系统，循序渐进地掌握现代 AI 应用开发技能。

### ✨ 核心特色

- 🎯 **前端友好**：基于 TypeScript/JavaScript 生态，无需学习 Python
- 📚 **渐进式学习**：9 个阶段，从 API 基础到 Agent 开发
- 🛠️ **实战驱动**：每个阶段都有完整的 Demo 和项目
- 🔧 **工程化**：pnpm monorepo 架构，依赖统一管理
-  **AI Provider 统一抽象**：通过 `shared-utils` 包统一管理所有模型提供商

---

## 🏗️ 项目结构

```
Front-end Developer AI Learning Plan/
├── packages/
│   └── shared-utils/          # 🎯 共享工具包（模型提供商统一抽象层）
│       ├── src/
│       │   ├── index.ts       # 统一导出
│       │   ├── config.ts      # 环境变量配置
│       │   ├── qwen.ts        # 阿里云通义千问
│       │   ├── openai.ts      # OpenAI 兼容接口
│       │   ├── deepseek.ts    # DeepSeek
│       │   └── ollama.ts      # 本地 Ollama 模型
│       └── package.json
│
├── stage-2-api/               # 📡 阶段二：LLM API 集成开发
│   ├── 01-generate-text.ts    # 基础文本生成
│   ├── 02-stream-text.ts      # 流式输出
│   ├── 03-chat-cli.ts         # 命令行多轮对话
│   ├── 04-generate-object.ts  # 结构化数据提取
│   └── 05-ollama-chat.ts      # Ollama 本地模型
│
├── stage-3-chat-app/          # 💬 阶段三：AI Chat Web 应用
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/chat/      # Chat API Route
│   │   │   └── page.tsx       # 聊天界面
│   │   └── components/        # React 组件
│   └── package.json
│
├── stage-4-rag/               # 🔍 阶段四：RAG 检索增强生成（命令行版）
│   ├── 01-embedding.ts        # Embedding 向量生成
│   ├── 02-similarity.ts       # 余弦相似度计算
│   ├── 03-chunking.ts         # 文档分块
│   ├── 04-indexing.ts         # 文档索引
│   ├── 05-search.ts           # 向量检索
│   └── 06-rag-qa.ts           # RAG 问答
│
├── stage-4-rag-app/           # 🌐 阶段四：RAG Web 应用
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/           # API Routes
│   │   │   └── page.tsx       # RAG 聊天界面
│   │   └── utils/             # 工具函数
│   └── package.json
│
├── stage-5-agent/             # 🤖 阶段五：Agent 开发核心
│   ├── 01-simple-tool.ts      # 简单工具调用
│   ├── 02-multi-tools.ts      # 多工具场景
│   ├── 03-web-agent.ts        # 网页搜索 Agent
│   ├── 04-data-agent.ts       # 数据查询 Agent
│   ├── 05-buffer-memory.ts    # Buffer Memory
│   ├── 06-summary-memory.ts   # Summary Memory
│   ├── 07-window-memory.ts    # Window Memory
│   └── tools/                 # Agent 工具模块
│
├── 知识总结/                   # 📖 学习笔记和总结
│   ├── 阶段一-LLM基础与PromptEngineering/
│   ├── 阶段二-LLM_API集成开发/
│   ├── 阶段三-构建AI_Chat_Web应用/
│   ├── 阶段四-RAG检索增强生成/
│   └── 阶段五-Agent开发核心/
│
├── package.json               # 根项目配置
├── pnpm-workspace.yaml        # pnpm workspace 配置
├── .env                       # 环境变量（API Keys）
└── 学习计划.md                # 完整学习计划文档
```

---

## 🚀 快速开始

### 环境要求

- **Node.js**: v22 LTS 或更高版本
- **pnpm**: 包管理器
- **Git**: 版本控制
- **API Key**: 至少一个大模型 API Key（推荐阿里云通义千问）

### 安装步骤

```bash
# 1. 克隆项目
git clone https://github.com/joker-yjc/hi-agent.git
cd hi-agent

# 2. 安装依赖（只需在根目录执行一次）
pnpm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入你的 API Key
```

### 环境变量配置

在项目根目录创建 `.env` 文件：

```env
# 阿里云通义千问（推荐）
ALIBABA_API_KEY=sk-xxx
ALIBABA_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1

# DeepSeek（可选）
DEEPSEEK_API_KEY=sk-xxx

# Ollama 本地模型（可选）
OLLAMA_BASE_URL=http://localhost:11434
```

### 运行各个阶段

```bash
# 阶段二：LLM API 集成（命令行脚本）
cd stage-2-api
pnpm tsx 01-generate-text.ts

# 阶段三：AI Chat Web 应用
pnpm dev:chat
# 打开 http://localhost:3000

# 阶段四：RAG（命令行版）
cd stage-4-rag
pnpm tsx 01-embedding.ts

# 阶段四：RAG Web 应用
pnpm dev:rag
# 打开 http://localhost:3001

# 阶段五：Agent 开发
cd stage-5-agent
pnpm tsx 01-simple-tool.ts
```

---

## 📚 学习路线

### 阶段概览

| 阶段 | 内容 | 天数 | 核心技能 |
|------|------|------|----------|
| **阶段一** | LLM 基础 & Prompt Engineering | Day 1-2 | Token、Context、Temperature、Prompt 技巧 |
| **阶段二** | LLM API 集成开发 | Day 3-5 | `generateText`、`streamText`、多轮对话、结构化输出 |
| **阶段三** | 构建 AI Chat Web 应用 | Day 6-9 | Next.js、`useChat`、Markdown 渲染、对话历史 |
| **阶段四** | RAG 检索增强生成 | Day 10-13 | Embedding、向量检索、文档问答 |
| **阶段五** | Agent 开发核心 | Day 14-19 | Tool Calling、ReAct 模式、记忆系统 |
| **阶段六** | MCP 协议 & 工具生态 | Day 20-22 | MCP Server 开发、工具扩展 |
| **阶段七** | 综合项目实战 | Day 23-27 | 完整 AI 应用开发 |
| **阶段八** | 高级主题（选学） | Day 28-33 | 成本控制、多模态、AI 安全、多 Agent |
| **阶段九** | LLM Wiki（选学） | Day 34-37 | 个人知识管理、Obsidian 集成 |

### 当前进度

- ✅ **阶段一**：LLM 基础与 Prompt Engineering
- ✅ **阶段二**：LLM API 集成开发
- ✅ **阶段三**：构建 AI Chat Web 应用
- ✅ **阶段四**：RAG 检索增强生成
- ✅ **阶段五**：Agent 开发核心（进行中）
- 🔄 **阶段六**：MCP 协议 & 工具生态
- ⏳ **阶段七**：综合项目实战
- ⏳ **阶段八**：高级主题（选学）
- ⏳ **阶段九**：LLM Wiki（选学）

---

## 🔧 技术栈

### 核心必学

| 技术 | 用途 | 版本 |
|------|------|------|
| **Vercel AI SDK** | LLM 集成核心库 | v6.0.143 |
| **Next.js** | 全栈框架（App Router） | 14/16 |
| **TypeScript** | 开发语言 | ^5 |
| **Zod** | Schema 验证 | ^4.3.6 |
| **pnpm** | 包管理（Monorepo） | workspace |
| **Ant Design** | UI 组件库 | ^6.3.x |

### AI 模型支持

| 提供商 | 模型 | 集成方式 |
|--------|------|----------|
| **阿里云通义千问** | qwen3-max、qwen-plus | `@ai-sdk/alibaba` |
| **OpenAI 兼容** | gpt-4o、gpt-4o-mini | `@ai-sdk/openai` |
| **DeepSeek** | deepseek-chat | `@ai-sdk/deepseek` |
| **Ollama** | qwen3:8b（本地） | `ollama-ai-provider-v2` |

### 工程化特性

- ✅ **Monorepo 架构**：pnpm workspace 统一管理
- ✅ **共享工具包**：`shared-utils` 统一模型提供商抽象
- ✅ **依赖提升**：公共依赖自动提升到根目录
- ✅ **环境变量统一**：根目录 `.env` 全局共享
- ✅ **TypeScript**：全项目类型安全

---

## 🎯 核心特性详解

### shared-utils：模型提供商统一抽象

所有阶段都通过 `shared-utils` 包访问 AI 模型，避免重复配置：

```typescript
// 统一导入方式
import { qwen, openai, deepseek, ollama } from "shared-utils"

// 创建模型实例
const model = qwen()  // 阿里云通义千问
const openaiModel = openai()  // OpenAI 兼容接口
const deepseekModel = deepseek()  // DeepSeek
const ollamaModel = ollama()  // 本地 Ollama

// 使用模型
const result = await generateText({
  model: model("qwen3-max"),
  prompt: "你好，请介绍一下自己"
})
```

**优势**：
- 🔒 配置统一：所有模型共享相同的环境变量
- 📦 依赖精简：各阶段只需声明 `shared-utils` 依赖
- 🔄 易于切换：修改一处配置，全局生效
- 🛡️ 避免冲突：版本统一管理

### pnpm Workspace：依赖管理优化

项目采用 pnpm workspace 架构，实现依赖统一管理：

```yaml
# pnpm-workspace.yaml
packages:
  - "packages/*"
  - "stage-*"
```

**工作原理**：
1. 根目录声明公共依赖（`ai`、`@ai-sdk/*`、`dotenv` 等）
2. 子项目通过 `workspace:*` 引用 `shared-utils`
3. pnpm 自动提升相同版本的依赖到根目录
4. 全局包缓存（`~/.pnpm-store`）节省磁盘空间

**效果**：
- 📉 磁盘占用减少约 **50%**
- 🚀 安装速度提升
- 🔧 版本冲突减少
- 📦 依赖关系清晰

---

## 📖 使用示例

### 示例 1：基础文本生成

```typescript
// stage-2-api/01-generate-text.ts
import { generateText } from "ai"
import { qwen } from "shared-utils"

const result = await generateText({
  model: qwen()("qwen3-max"),
  prompt: "用一句话介绍人工智能"
})

console.log(result.text)
```

### 示例 2：流式对话

```typescript
// stage-2-api/02-stream-text.ts
import { streamText } from "ai"
import { qwen } from "shared-utils"

const result = streamText({
  model: qwen()("qwen3-max"),
  prompt: "写一首关于春天的诗"
})

for await (const chunk of result.textStream) {
  process.stdout.write(chunk)
}
```

### 示例 3：Agent 工具调用

```typescript
// stage-5-agent/01-simple-tool.ts
import { generateText, tool } from "ai"
import { qwen } from "shared-utils"
import { z } from "zod"

const getTimeTool = tool({
  description: "获取当前时间",
  parameters: z.object({}),
  execute: async () => {
    return new Date().toLocaleString("zh-CN")
  }
})

const result = await generateText({
  model: qwen()("qwen3-max"),
  messages: [{ role: "user", content: "现在几点了？" }],
  tools: [getTimeTool],
  maxSteps: 5
})

console.log(result.text)
```

### 示例 4：RAG 检索增强

```typescript
// stage-4-rag/06-rag-qa.ts
import { generateText, embed } from "ai"
import { qwen } from "shared-utils"

// 1. 将用户问题转为 Embedding
const questionEmbedding = await embed({
  model: qwen().embedding("text-embedding-v3"),
  value: "React Hooks 有哪些？"
})

// 2. 向量检索相关文档
const relevantChunks = searchVectorDB(questionEmbedding, topK: 3)

// 3. 将文档作为上下文生成回答
const result = await generateText({
  model: qwen()("qwen3-max"),
  messages: [
    { role: "system", content: `基于以下文档回答问题：\n${relevantChunks}` },
    { role: "user", content: "React Hooks 有哪些？" }
  ]
})

console.log(result.text)
```

---

## 🛠️ 开发命令

### 常用脚本

```bash
# 安装所有依赖
pnpm install

# 启动阶段三 Chat 应用
pnpm dev:chat

# 启动阶段四 RAG 应用
pnpm dev:rag

# 进入特定阶段目录
pnpm stage-2    # stage-2-api
pnpm stage-4    # stage-4-rag
pnpm stage-5    # stage-5-agent

# 运行 TypeScript 脚本
pnpm tsx 01-generate-text.ts

# 类型检查
pnpm tsc --noEmit
```

### 调试技巧

```bash
# 查看详细日志
DEBUG=* pnpm tsx 01-generate-text.ts

# 清理缓存重新安装
pnpm install --force

# 检查依赖树
pnpm list

# 查看符号链接（验证依赖提升）
ls -la node_modules/shared-utils
```

---

## 📝 学习笔记

项目包含详细的学习笔记和知识总结，位于 `知识总结/` 目录：

- **阶段一**：LLM 基础概念、Prompt Engineering 技巧
- **阶段二**：Vercel AI SDK 使用、API 调用最佳实践
- **阶段三**：Next.js 集成、Chat UI 设计模式
- **阶段四**：RAG 原理、Embedding 技术、向量检索
- **阶段五**：Agent 架构、Tool Calling、记忆系统

每篇笔记都包含：
- 📖 理论学习
- 💡 实践案例
- ⚠️ 常见问题
- 🔗 参考资料

---

## 🔐 安全注意事项

### API Key 管理

- ⚠️ **永远不要提交 `.env` 文件到 Git**
- ✅ 使用 `.gitignore` 排除敏感文件
- ✅ 使用 `.env.example` 提供配置模板
- ✅ 生产环境使用环境变量注入

### 费用控制

- 💰 学习阶段使用低成本模型（如 `qwen-plus`、`gpt-4o-mini`）
- 📊 定期检查 API 用量
- 🔄 本地模型优先（Ollama）
- ⚡ 优化 Prompt 长度，减少 token 消耗

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

### 提交 PR 前请检查

- [ ] 代码有中文注释（JSDoc 格式）
- [ ] TypeScript 类型检查通过
- [ ] 依赖已正确声明
- [ ] 更新相关文档

### 代码规范

- 使用 TypeScript 严格模式
- 所有函数添加 JSDoc 注释
- 变量命名使用 camelCase
- 组件命名使用 PascalCase

---

## 📄 许可证

MIT License

---

## 🙏 致谢

- **Vercel AI SDK** - 优秀的 AI 应用开发框架
- **Next.js** - 现代化的 React 框架
- **Datawhale Hello-Agents** - 智能体学习教程
- **OpenAI / Anthropic / 阿里云** - 提供强大的 AI 模型

---

## 📧 联系方式

- **作者**：joke_yao
- **GitHub**：https://github.com/joker-yjc
- **学习计划**：详见 [学习计划.md](./学习计划.md)

---

> 💡 **提示**：每个阶段完成后，可以运行 Demo 进行自我验收。详细验收标准请参考 [学习计划.md](./学习计划.md) 中各阶段的"验收 Demo"部分。

**祝你学习愉快！**
