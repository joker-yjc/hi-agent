# 第 23 章：AI + 前端实战案例

> 本章目标：整合阶段八的所有高级主题，完成一个具备真实应用价值的实战项目。
> 对应学习计划：Day 33
> 🚧 本章为项目指导框架，具体实现需根据你选择的方向展开。

---

## 概念速览

### 阶段八的知识图谱

经过前 5 章（第 18-22 章）的学习，你的能力矩阵扩展为：

```
原有能力（第 1-17 章）          新增能力（第 18-22 章）
──────────────────          ──────────────────
Chat UI + 流式对话             成本控制 + 模型路由
RAG 检索增强                   多模态图片理解
Agent + Tool Calling           多模态图片生成
记忆系统                       AI 安全防护
MCP 协议                       多 Agent 编排
```

### 本章的定位

这不是"再学一个新概念"，而是**选一个方向，把前面学的东西组合成一个完整产品**。

关键区别：
- 第 17 章的综合项目侧重 Chat + RAG + Agent + Memory 的基础整合
- 本章侧重引入阶段八的新能力（多模态 / 安全 / 多Agent / 成本控制）

---

## 技术选型与项目方向

### 方向 A：AI 代码审查助手（推荐）

融合能力：Agent + Vision（代码截图分析） + 安全（输入过滤） + 模型路由（简单问题用小模型）

```
用户流程：
1. 粘贴代码片段 或 上传代码截图
2. AI 分析代码质量（静态分析 Agent）
3. 输出审查报告：问题列表 + 严重等级 + 修复建议
4. 可选：一键生成修复后的代码

技术架构：
├── 前端
│   ├── 代码输入区（Monaco Editor 或 Textarea）
│   ├── 图片上传区（第 19 章的 Vision 能力）
│   └── 报告展示区（Markdown 渲染）
├── 后端
│   ├── /api/review       → Agent + 模型路由
│   ├── /api/vision       → 截图 → 代码提取 → 审查
│   └── 输入过滤中间件    → 第 21 章的安全防护
└── 代码分析 Tools
    ├── detect_language    → 检测代码语言
    ├── check_patterns     → 正则匹配常见问题
    └── suggest_fix        → 生成修复建议
```

### 方向 B：智能文档问答助手（多模态增强版）

融合能力：RAG + Vision（图片内文字提问） + 成本控制 + 安全

```
在第 17 章综合项目基础上增加：
- 支持上传截图提问（"这张架构图中 A 和 B 是什么关系？"）
- 模型路由：简单问题 qwen-turbo，复杂分析 qwen-max
- 输入输出安全过滤
- Token 用量追踪面板
```

### 方向 C：AI 客服机器人

融合能力：RAG（产品知识库） + Agent（订单查询工具） + Vision（图片识别） + 多Agent（路由到不同技能组）

```
多 Agent 架构：
├── Router Agent → 判断用户意图
├── FAQ Agent → 基于 RAG 回答常见问题
├── Order Agent → 调用工具查询订单状态
└── Image Agent → 处理用户上传的截图（如商品图、错误截图）
```

---

## 代码骨架

### 项目脚手架（以方向 A 为例）

思路：先搭最小可运行的骨架，确保 `pnpm dev` 能跑起来，再逐步填充功能。

```
stage-8-project/
├── app/
│   ├── page.tsx              ← 主页面
│   ├── api/
│   │   ├── review/route.ts   ← 代码审查 API
│   │   └── vision/route.ts   ← 图片分析 API
│   └── layout.tsx
├── components/
│   ├── CodeInput.tsx          ← 代码输入组件
│   ├── ImageUploader.tsx      ← 图片上传组件（复用第 19 章）
│   └── ReviewReport.tsx       ← 审查报告展示
├── lib/
│   ├── agents/
│   │   ├── router.ts          ← Router Agent（第 22 章）
│   │   └── code-reviewer.ts   ← 代码审查 Agent
│   ├── safety.ts              ← 输入输出过滤（第 21 章）
│   └── cost-tracker.ts        ← Token 费用追踪（第 18 章）
├── package.json
└── next.config.ts
```

### 代码审查 API Route

思路：用 Agent + Tool Calling 实现代码审查，加入安全过滤和成本追踪。

```typescript
// app/api/review/route.ts — 骨架思路
import { generateText, tool } from 'ai'
import { qwen } from 'shared-utils'
import { z } from 'zod'
import { detectInjection } from '@/lib/safety'
import { selectModel } from '@/lib/cost-tracker'

export async function POST(req: Request) {
  const { code, language } = await req.json()

  // 思路：安全过滤（第 21 章）
  const check = detectInjection(code)
  if (!check.safe) {
    return Response.json({ error: '无法处理该请求' }, { status: 400 })
  }

  // 思路：模型路由（第 18 章）— 短代码用便宜模型，长代码用好模型
  const modelId = selectModel(code)

  const result = await generateText({
    model: qwen(modelId),
    system: `你是一个代码审查专家。分析代码的质量问题，输出结构化的审查报告。
语言：${language || '自动检测'}`,
    prompt: code,
    tools: {
      // 思路：Agent 可以调用工具来辅助分析
      report_issue: tool({
        description: '报告一个代码问题',
        parameters: z.object({
          line: z.number().describe('问题所在行号（大约）'),
          severity: z.enum(['error', 'warning', 'info']),
          message: z.string().describe('问题描述'),
          suggestion: z.string().describe('修复建议'),
        }),
        execute: async (params) => params, // 思路：直接返回结构化数据
      }),
    },
    maxSteps: 5, // 思路：让 Agent 多次调用 report_issue 报告多个问题
  })

  // 思路：从 Agent 的工具调用中提取所有报告的问题
  const issues = result.steps
    .flatMap(step => step.toolResults)
    .filter(Boolean)

  return Response.json({
    issues,
    summary: result.text,
    usage: result.usage,
    model: modelId,
  })
}
```

### 整合 Vision 的图片审查路由

思路：用户上传代码截图时，先用 Vision 模型"读"出代码文字，再交给代码审查 Agent。

```typescript
// app/api/vision/route.ts — 截图代码审查
import { generateText } from 'ai'
import { qwen } from 'shared-utils'

export async function POST(req: Request) {
  const { imageDataUrl, reviewPrompt } = await req.json()

  // 思路：第一步 — Vision 模型提取代码内容
  const extraction = await generateText({
    model: qwen('qwen-vl-max'),
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: '请精确提取这张截图中的所有代码文字，保持原始缩进和格式。只输出代码，不要添加任何解释。' },
        { type: 'image', image: imageDataUrl },
      ],
    }],
  })

  // 思路：第二步 — 把提取的代码交给审查 Agent（复用 /api/review 的逻辑）
  // 这里可以直接调用 /api/review 的处理函数，或者内联实现
  const reviewResult = await generateText({
    model: qwen('qwen-max'),
    system: '你是一个代码审查专家。分析以下从截图中提取的代码，找出潜在问题。',
    prompt: `${reviewPrompt || '请审查以下代码'}\n\n${extraction.text}`,
  })

  return Response.json({
    extractedCode: extraction.text,
    review: reviewResult.text,
  })
}
```

---

## 实战建议（Day 33 任务指南）

### 步骤 1：确定项目方向

```
决策思路：
- 如果你对前面的 Vision 章节最感兴趣 → 选方向 A（代码审查）
- 如果你对 RAG 更熟悉 → 选方向 B（文档问答增强版）
- 如果想练多 Agent → 选方向 C（客服机器人）
- 不确定 → 选 A，因为它最能体现"前端开发者"的独特价值
```

### 步骤 2：搭骨架

```
实现思路：
1. 初始化 Next.js 项目（或在现有项目上扩展）
2. 先让一个最简单的 API Route 跑通（不加 Vision/安全/成本，只有基础 generateText）
3. 前端先用最简单的 Textarea + Button + 结果展示
4. 确认端到端流程走通后，再逐步加入高级能力
```

### 步骤 3：逐步整合高级能力

```
推荐顺序（由易到难）：
1. 基础审查功能（Agent + Tool Calling） ← 核心，先做这个
2. 成本追踪（读 usage 字段，前端展示） ← 加几行代码
3. 输入过滤（detectInjection） ← 复制第 21 章代码
4. 模型路由（selectModel） ← 简单 if-else
5. 图片截图审查（Vision） ← 新增一个 API Route
```

### 步骤 4：编写项目文档

```
文档模板：
1. 项目简介：解决什么问题
2. 技术栈：用了哪些技术，为什么选它们
3. 架构图：数据流走向
4. 运行方式：pnpm install && pnpm dev
5. 核心功能演示：截图或 GIF
6. 已知限制和后续计划
```

---

## 踩坑记录

⚠️ **坑 1：什么都想做，结果什么都没做完**
Day 33 只有一天时间，试图把 Vision + 安全 + 多Agent + 成本控制全部做进去，最后没一个跑通。
→ **铁律**：先做核心功能（代码审查本身），跑通后再加其他能力。每加一个能力确认能用了再加下一个。

⚠️ **坑 2：Vision 模型提取代码不一定准确**
从截图中提取代码，模型可能会搞错缩进、遗漏某些字符。
→ **怎么绕**：提取后让用户确认/编辑代码内容，再提交审查。不要 100% 信任 Vision 的提取结果。

⚠️ **坑 3：多 Agent 在小项目中是杀鸡用牛刀**
代码审查助手不需要 Supervisor 模式 — 一个好的 Agent + 几个 Tool 就够了。
→ **判断**：如果你选择方向 A 或 B，大概率不需要多 Agent。只有方向 C（客服，需要路由到不同技能组）才真正需要。

---

## 练习

### 基础练习
1. 选定一个项目方向，搭建最小可运行骨架（page.tsx + 一个 API Route）
2. 实现核心功能并确认端到端流程跑通

### 进阶挑战
1. 在项目中整合至少 3 个阶段八的高级能力（成本控制 / Vision / 安全 / 多Agent 中选 3 个）
2. 写一份完整的项目 README，包含架构图和运行说明

### 思考题
1. 你选择的项目方向中，哪些功能是"必须有"的，哪些是"锦上添花"的？如何排优先级？
2. 如果你有一周时间（而不是一天），你还会加哪些功能？它们的技术难点在哪里？

---

## 延伸阅读

| 资料 | 推荐理由 |
|------|---------|
| [Vercel AI SDK Examples](https://github.com/vercel/ai/tree/main/examples) | 📖 AI SDK 官方示例集，各种场景的参考实现 |
| [Next.js App Router Docs](https://nextjs.org/docs/app) | 📖 Next.js App Router 最新文档 |
| 本手册第 17-22 章 | ✅ 综合项目架构 + 各高级主题的代码骨架 |
| [Vercel Templates](https://vercel.com/templates/ai) | 📖 Vercel 官方的 AI 应用模板，可以参考架构 |

---

| [← 上一章：多 Agent 编排调度](../chapter22/README.md) | [下一章：LLM Wiki 概念与工具 →](../chapter24/README.md) |
