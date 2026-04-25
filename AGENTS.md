# AI 学习计划项目 — Agent 开发指南

> 多阶段递进式 LLM/Agent 学习项目，pnpm monorepo 结构。

---

## 项目结构

这是一个**学习计划项目**，不是生产系统。包含 5 个阶段子项目 + 1 个共享包：

```
packages/shared-utils/    # 统一导出模型 Provider（deepseek/qwen/openai/ollama）
stage-2-api/              # 纯脚本：LLM API 调用基础
stage-3-chat-app/         # Next.js Web：聊天应用（Next.js 16 + React 19）
stage-4-rag/              # 纯脚本：RAG 检索流程
stage-4-rag-app/          # Next.js Web：RAG 文档问答（Next.js 14 + React 18）
stage-5-agent/            # 纯脚本：Agent + 记忆系统
```

**关键区分**：
- **纯脚本项目**（stage-2/4/5）：直接用 `npx tsx 01-xxx.ts` 运行，无构建步骤
- **Web 项目**（stage-3/4-rag-app）：需要 `pnpm dev` 启动开发服务器

---

## 快速运行

### 根目录快捷命令

```bash
# 启动 Web 项目
pnpm dev:chat        # stage-3-chat-app  (localhost:3000)
pnpm dev:rag         # stage-4-rag-app   (localhost:3000，端口冲突时改 package.json)

# 进入脚本项目运行环境
pnpm stage-2         # cd stage-2-api + pnpm 上下文
pnpm stage-4         # cd stage-4-rag + pnpm 上下文
pnpm stage-5         # cd stage-5-agent + pnpm 上下文
```

### 脚本项目运行方式

```bash
cd stage-5-agent
npx tsx 01-simple-tool.ts        # 直接运行单个脚本
npx tsx 06-summary-memory.ts     # 交互式对话脚本
```

### Web 项目运行方式

```bash
cd stage-3-chat-app
pnpm install   # 如果 node_modules 缺失
pnpm dev       # localhost:3000
```

---

## 环境变量与 API Key

**所有 API Key 集中在根目录 `.env`**，各子项目通过 `shared-utils/config` 自动加载：

```bash
# 根目录 .env 示例
ALIBABA_API_KEY="sk-xxx"
ALIBABA_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"
DEEPSEEK_API_KEY="sk-xxx"
OLLAMA_BASE_URL="http://localhost:11434/api"
```

- `.env` 已被 `.gitignore` 忽略，**不会提交**
- 如需添加新 Key，修改根目录 `.env`，各子项目自动生效
- 各子项目无独立 `.env` 文件

---

## 模型调用方式

**不要直接 import `@ai-sdk/openai`**，统一使用 `shared-utils`：

```typescript
// ✅ 正确
import { qwen, deepseek } from 'shared-utils';

const result = await generateText({
  model: qwen('qwen-turbo'),           // 阿里云通义
  // model: deepseek('deepseek-chat'), // DeepSeek
  prompt: '...',
});
```

支持的 Provider：`qwen`, `deepseek`, `openai`, `ollama`

---

## 版本差异陷阱

| 项目 | Next.js | React | 特殊注意 |
|------|---------|-------|---------|
| **stage-3-chat-app** | 16.2.1 | 19.2.4 | App Router, 最新 API, 可能有 breaking changes |
| **stage-4-rag-app** | 14.0.4 | 18 | App Router, 稳定版，API 较旧 |

**不要混用两个项目的代码**：
- stage-3 的 `next.config.ts` / `eslint.config.mjs` 等配置可能与 stage-4-rag-app 不兼容
- stage-3 使用 Tailwind CSS v4 + `@tailwindcss/postcss`，stage-4-rag-app 未配置 Tailwind
- React 19 vs 18 的 type 差异可能导致类型错误

---

## 代码规范

- **语言**：所有输出用中文，代码注释用中文
- **注释**：遵循 JSDoc 标准（文件/模块、接口、函数、变量均需注释）
- **TypeScript**：strict 模式，禁止 `any`
- **包管理**：只用 `pnpm`，不要混用 npm/yarn

---

## 常见操作

| 需求 | 命令 |
|------|------|
| 安装所有依赖 | 根目录运行 `pnpm install` |
| 运行 stage-5 某个脚本 | `cd stage-5-agent && npx tsx 06-summary-memory.ts` |
| 启动 chat 应用 | `pnpm dev:chat` |
| 启动 rag 应用 | `pnpm dev:rag` |
| 类型检查 | `cd stage-3-chat-app && npx tsc --noEmit` |

---

## 扩展新项目

如需新增 stage：
1. 在根目录创建 `stage-X-xxx/` 文件夹
2. `package.json` 中声明 `"name": "stage-X-xxx"`
3. 依赖 `shared-utils` 时声明 `"shared-utils": "workspace:*"`
4. Web 项目参考 stage-3-chat-app 或 stage-4-rag-app 的配置
5. 纯脚本项目参考 stage-5-agent 的配置（`"type": "commonjs"` 或 `"module"`）

---

## 重要文件索引

| 文件 | 作用 |
|------|------|
| `学习计划.md` | 完整的学习路线规划 |
| `handbook/` | **AI 开发知识手册**（25 章 + 速查表，7 个部分覆盖 Day 1-37 全部学习内容） |
| `知识总结/README.md` | Day 1-16 知识点归纳（按阶段组织） |
| `packages/shared-utils/src/` | 模型 Provider 统一配置 |
| `stage-3-chat-app/AGENTS.md` | stage-3 专属开发指南 |

---

> 最后更新：2026-04-22