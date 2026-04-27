# 第 22 章：多 Agent 编排调度

> 本章目标：理解为什么需要多 Agent，掌握常见的编排模式，能用 AI SDK 实现 Supervisor 和 Pipeline 两种基础模式。
> 对应学习计划：Day 32
> 🚧 多 Agent 编排是快速演进的领域，本章侧重概念框架和可运行骨架，具体产品实现会持续变化。

---

## 概念速览

### 为什么单 Agent 不够用

回顾第 10-11 章：一个 Agent = LLM + Tools + Loop。它通过循环调用工具来完成任务。

问题是：当任务涉及多个**不同领域的能力**时，一个 Agent 的 System Prompt 会变得又长又矛盾。

```
单 Agent 困境：
  "你是一个代码审查专家 + 文档写作专家 + 数据分析专家..."
  → System Prompt 过长，角色定位模糊
  → 工具列表膨胀，模型选错工具的概率增加
  → 所有能力塞在一起，难以独立优化
```

多 Agent 的思路：**让不同的 Agent 各司其职，再用一个协调机制把它们组织起来**。

### 四种常见编排模式

| 模式 | 结构 | 适用场景 |
|------|------|---------|
| **Supervisor** | 主管 Agent 分派任务给专职 Agent | 用户意图多样，需要先判断再分流 |
| **Pipeline** | Agent A → B → C 串行处理 | 任务有明确的阶段（研究→分析→输出） |
| **Parallel** | 多 Agent 并行处理，结果汇总 | 需要多角度分析同一问题 |
| **Debate** | 多 Agent 互相辩论/校验 | 需要高可靠性的判断 |

### 主流产品中的实际应用

| 产品 | 架构类型 | 特点 |
|------|---------|------|
| Coze | Pipeline/Supervisor | 编排平台，可视化配置触发条件和分发规则 |
| Claude Code (Task) | 任务池 | 主对话按需创建 Task 子 Agent，任务池并行 |
| Qoder (explore-agent 等) | 工具型 | 每个子 Agent 专注特定工具能力 |
| CrewAI | 角色型 | 多个专家 Agent 按角色分工协作 |

---

## 技术选型

### 用 AI SDK 实现多 Agent 的思路

AI SDK 本身不提供"多 Agent 编排框架"，但你可以用 `generateText` + `tool` 组合出来：

```
实现路径：

1. 每个"子 Agent"就是一个 generateText 调用
   → 不同的 System Prompt + 不同的 Tools
   → 函数封装，接收输入返回输出

2. "协调器"是另一个 generateText 调用（或普通 JS 逻辑）
   → 决定调用哪个子 Agent
   → 把子 Agent 的输出拼接/汇总

3. 不需要引入新框架
   → 学习阶段用纯 AI SDK 就能实现
   → 如果后续需要复杂工作流，再考虑 Mastra 或 LangGraph
```

### 框架对比（概念参考）

| 框架 | 语言 | 多 Agent 支持 | 前端友好度 |
|------|------|-------------|-----------|
| AI SDK（手动编排） | TS | 需自己实现 | ⭐⭐⭐⭐⭐ |
| Mastra | TS | Workflow 原生支持 | ⭐⭐⭐⭐ |
| LangGraph.js | TS | 图状态机 | ⭐⭐⭐ |
| CrewAI | Python | 原生多 Agent | ⭐（Python） |

---

## 代码骨架

### 1. Supervisor 模式：主管路由

思路：一个 Router Agent 分析用户意图，决定分派给哪个专职 Agent。每个专职 Agent 有独立的 System Prompt 和 Tools。

```typescript
import { generateText, Output } from 'ai'
import { qwen } from 'shared-utils'
import { z } from 'zod'

// 思路：先定义子 Agent — 每个是一个独立函数，有自己的角色和能力
async function codeReviewAgent(code: string): Promise<string> {
  const result = await generateText({
    model: qwen('qwen-max'),
    system: '你是一个代码审查专家。分析代码质量、潜在 bug、安全问题。输出格式：问题列表 + 严重等级。',
    prompt: `请审查以下代码：\n\n${code}`,
  })
  return result.text
}

async function docWriterAgent(topic: string): Promise<string> {
  const result = await generateText({
    model: qwen('qwen-turbo'), // 思路：文档写作用便宜模型就够
    system: '你是一个技术文档写作专家。输出清晰、结构化的技术文档。',
    prompt: `请撰写关于"${topic}"的技术文档`,
  })
  return result.text
}

// 思路：Router Agent — 用结构化输出判断意图，而不是让模型自己用自然语言说
async function routerAgent(userMessage: string): Promise<string> {
  const { object: routing } = await generateText({
    model: qwen('qwen-turbo'),
    system: '你是一个任务路由器。根据用户消息判断应该交给哪个专家处理。',
    prompt: userMessage,
    // 思路：用 Output.object 强制输出结构化的路由结果
    experimental_output: Output.object({
      schema: z.object({
        agent: z.enum(['code_review', 'doc_writer']),
        reason: z.string(),
      }),
    }),
  })

  console.log(`路由决策: ${routing.agent}（${routing.reason}）`)

  // 思路：根据路由结果调用对应的子 Agent
  switch (routing.agent) {
    case 'code_review':
      return codeReviewAgent(userMessage)
    case 'doc_writer':
      return docWriterAgent(userMessage)
  }
}

// 使用
const answer = await routerAgent('帮我审查这段 React 组件代码：function App() { ... }')
```

### 2. Pipeline 模式：串行流水线

思路：任务分成多个阶段，每个阶段一个 Agent，上一个的输出是下一个的输入。

```typescript
// 思路：Pipeline 的核心是"上一个输出 → 下一个输入"的串行链

// 阶段 1：研究员 — 收集和整理信息
async function researcherAgent(topic: string): Promise<string> {
  const result = await generateText({
    model: qwen('qwen-max'),
    system: '你是一个研究员。给出关于指定话题的要点清单（5-8 个要点），每个要点一句话。',
    prompt: `请研究：${topic}`,
  })
  return result.text
}

// 阶段 2：分析师 — 深入分析
async function analystAgent(researchResult: string): Promise<string> {
  const result = await generateText({
    model: qwen('qwen-max'),
    system: '你是一个分析师。基于研究结果，给出深入分析和见解。指出关键趋势和风险。',
    prompt: `基于以下研究结果进行分析：\n\n${researchResult}`,
  })
  return result.text
}

// 阶段 3：编辑 — 润色输出
async function editorAgent(analysisResult: string): Promise<string> {
  const result = await generateText({
    model: qwen('qwen-turbo'), // 思路：润色格式用便宜模型
    system: '你是一个编辑。将分析报告整理成结构清晰、易读的最终报告。使用 Markdown 格式。',
    prompt: `请整理以下分析报告：\n\n${analysisResult}`,
  })
  return result.text
}

// 思路：Pipeline 就是简单的函数串联
async function pipeline(topic: string): Promise<string> {
  console.log('阶段 1/3: 研究中...')
  const research = await researcherAgent(topic)

  console.log('阶段 2/3: 分析中...')
  const analysis = await analystAgent(research)

  console.log('阶段 3/3: 编辑中...')
  const report = await editorAgent(analysis)

  return report
}

const report = await pipeline('2026 年前端开发趋势')
```

### 3. Parallel 模式：并行 + 汇总

思路：多个 Agent 同时处理同一个问题，最后由一个汇总 Agent 整合结果。适合需要多角度分析的场景。

```typescript
// 思路：Promise.all 实现真正的并行调用，节省时间

async function parallelAnalysis(question: string): Promise<string> {
  // 并行调用三个不同角度的 Agent
  const [techView, businessView, userView] = await Promise.all([
    generateText({
      model: qwen('qwen-turbo'),
      system: '你是技术专家。从技术可行性角度分析问题。',
      prompt: question,
    }),
    generateText({
      model: qwen('qwen-turbo'),
      system: '你是商业分析师。从商业价值和成本角度分析问题。',
      prompt: question,
    }),
    generateText({
      model: qwen('qwen-turbo'),
      system: '你是用户体验专家。从用户需求和体验角度分析问题。',
      prompt: question,
    }),
  ])

  // 思路：汇总 Agent 整合三个视角的结论
  const summary = await generateText({
    model: qwen('qwen-max'), // 汇总用好模型
    system: '你是一个综合分析师。整合多个专家的观点，给出全面的结论。',
    prompt: `
技术视角：${techView.text}

商业视角：${businessView.text}

用户视角：${userView.text}

请综合以上三个视角，给出最终分析结论。`,
  })

  return summary.text
}
```

---

## 实战建议（Day 32 任务指南）

### 任务 1：阅读参考资料，理解编排模式

```
实现思路：
1. 阅读 LangGraph Multi-Agent 概念文档（理解编排模式的理论）
   https://langchain-ai.github.io/langgraphjs/concepts/multi_agent/
2. 浏览 Mastra Workflows 文档（看 TS 生态怎么做）
   https://mastra.ai/docs/workflows/overview
3. 用自己的话总结：什么时候该用多 Agent，什么时候单 Agent 就够
```

### 任务 2：编写 `03-supervisor-pattern.ts`

```
实现思路：
1. 实现 Router Agent + 2 个专职 Agent（代码审查 + 文档写作）
2. 准备 5 条测试消息，覆盖：
   - 明确是代码审查的请求
   - 明确是文档写作的请求
   - 模糊的请求（看 Router 怎么决策）
3. 打印 Router 的路由决策和最终结果
```

### 任务 3：编写 `04-pipeline-pattern.ts`

```
实现思路：
1. 实现三阶段 Pipeline：研究员 → 分析师 → 编辑
2. 给定一个话题（如"React Server Components 的利与弊"）
3. 打印每个阶段的输入输出，观察信息如何在 Agent 之间流转
4. 统计总 Token 消耗和耗时（多 Agent 的成本放大效应）
```

### 任务 4：对比总结

```
整理一份对比表：

| 维度 | 单 Agent | 多 Agent (Supervisor) | 多 Agent (Pipeline) |
|------|---------|---------------------|-------------------|
| 复杂度 | | | |
| 延迟 | | | |
| Token 成本 | | | |
| 可控性 | | | |
| 适用场景 | | | |
```

---

## 踩坑记录

⚠️ **坑 1：多 Agent 的 Token 成本是乘法不是加法**
Supervisor 模式下，Router 调用一次 + 子 Agent 调用一次 = 至少 2 次 LLM 调用。Pipeline 三阶段 = 至少 3 次调用。每次调用都消耗 Token。
→ **怎么绕**：Router 用最便宜的模型（它只做分类），子 Agent 按需选模型。Pipeline 中间阶段的输出不需要太详细。

⚠️ **坑 2：Router 分错类的后果比你想的严重**
Router 把代码审查请求发给了文档写作 Agent，用户得到的回答完全牛头不对马嘴。
→ **怎么绕**：用结构化输出（`Output.object`）+ 严格的 schema 让 Router 做选择题，比自由文本输出靠谱得多。

⚠️ **坑 3：Pipeline 中间某环节失败会导致整链崩溃**
如果分析师 Agent 的调用超时了，后面的编辑 Agent 收到的输入是空的。
→ **怎么绕**：每个阶段加 try-catch，失败时要么重试，要么把错误信息传给下一个阶段让它知道上游出了问题。

⚠️ **坑 4：不要一上来就用多 Agent**
多 Agent 编排看起来很酷，但大多数场景下一个好的 System Prompt + 几个 Tool 的单 Agent 就够了。过早引入多 Agent 只会增加复杂度和成本。
→ **判断标准**：如果你的单 Agent 的 System Prompt 超过 2000 字，或者 Tool 超过 10 个，才考虑拆分。

---

## 练习

### 基础练习
1. 实现 Supervisor 模式：Router + 2 个专职 Agent，测试 5 条不同意图的消息
2. 实现 Pipeline 模式：3 个阶段的串行处理，打印每个阶段的输出

### 进阶挑战
1. 在 Supervisor 模式中加入 fallback：当 Router 判断"不属于任何已有 Agent 的职责"时，用一个通用 Agent 兜底
2. 实现 Parallel + Debate：三个 Agent 分别回答同一个问题，然后让一个"裁判" Agent 评估谁的回答最好

### 思考题
1. 多 Agent 编排的"协调成本"（Router 的 Token 消耗 + 延迟）什么时候会超过它带来的"分工收益"？
2. 如果你要为你的综合项目（第 17 章）引入多 Agent，你会怎么拆分？哪些功能适合独立成子 Agent？

---

## 延伸阅读

| 资料 | 推荐理由 |
|------|---------|
| [LangGraph Multi-Agent Concepts](https://langchain-ai.github.io/langgraphjs/concepts/multi_agent/) | 📖 多 Agent 编排模式的最系统化讲解 |
| [Mastra Workflows](https://mastra.ai/docs/workflows/overview) | 📖 TypeScript 生态的工作流编排方案 |
| [OpenAI Agents SDK (JS)](https://openai.github.io/openai-agents-js/) | 📖 OpenAI 官方的 Agent 编排方案 |
| [CrewAI Concepts](https://docs.crewai.com/concepts/crews) | 📖 多 Agent 协作框架（Python，概念参考） |

---

| [← 上一章：AI 安全基础](../chapter21/README.md) | [下一章：AI + 前端实战案例 →](../chapter23/README.md) |
