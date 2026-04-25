# 第 14 章：Agent 框架对比与 Skill 设计

> 本章目标：了解前端生态中主要的 Agent 框架，学会对比选型。理解 Skill 设计模式的本质。
> 对应学习计划：Day 19
> 状态：🚧 内容基于理论调研，部分待实际验证

---

## 概念速览

### 框架存在的价值

Vercel AI SDK 已经提供了 `tool()` + `maxSteps`，为什么还需要框架？

| AI SDK 裸写 | Agent 框架（Mastra 等） |
|------------|----------------------|
| 你需要手动管理每一轮消息 | 框架自动编排多步推理 |
| 没有工作流引擎 | 内置工作流：A → B → C 或并行 |
| 错误恢复靠 `try-catch` | 框架自动重试 + 降级 |
| 适合简单的 Agent 逻辑 | 适合复杂的多 Agent 协作 |

### 前端生态的主要框架

| 框架 | 语言 | 特点 | 适用场景 |
|------|------|------|---------|
| **Vercel AI SDK** | TS | 最底层，最灵活 | 简单 Agent，自定义需求 |
| **Mastra** | TS | Agent + Workflow 原语 | 复杂工作流，多 Agent 编排 |
| **LangChain.js** | TS | 生态最全 | 需要大量现成的工具链 |
| **LangGraph.js** | TS | 状态机式 Agent 编排 | 复杂多 Agent 图编排 |
| **CrewAI** | Python | 角色分工模式 | Python 生态偏好 |

✅ **推荐学习路线**：
1. 先用 AI SDK 裸写（理解底层）
2. 体验一下 Mastra（感受框架的好处）
3. 深入了解 LangChain.js（市场占有率最高）

---

## 一句话总结

框架的价值在于自动化编排多步推理、工作流和错误恢复。先用 AI SDK 裸写理解底层，再根据复杂度选择框架。Skill 是 Prompt + 工具 + 工作流的封装，目标是"可复用的能力包"。

---

## 技术选型

### 什么时候该上框架

| 场景 | 推荐方案 |
|------|---------|
| 1-2 个简单工具 | AI SDK 裸写就够了 |
| 3+ 工具 + 多步推理 | 考虑 Mastra |
| 需要工作流引擎（A→B→C→D） | Mastra Workflow |
| 需要图编排（循环、条件分支） | LangGraph |
| Python 技术栈 | CrewAI |

---

## 代码骨架

### Mastra Agent 最小示例

```typescript
// mastra demo
import { Mastra } from '@mastra/core'
import { createTool } from '@mastra/core/tools'

const weatherTool = createTool({
  id: 'get-weather',
  description: '获取城市天气',
  inputSchema: z.object({ city: z.string() }),
  execute: async ({ context }) => {
    return { city: context.city, temp: 25, condition: '晴' }
  },
})

const agent = new Mastra().agent({
  name: '天气助手',
  model: qwen('qwen3-max'),
  tools: { weatherTool },
  instructions: '你是一个天气查询助手',
})
```

### Mastra Workflow 示例

```typescript
// 定义多步骤工作流
const workflow = mastra.workflow({
  name: 'research-report',
  steps: [
    { name: 'search', handler: searchAgent },
    { name: 'analyze', handler: analyzeAgent },
    { name: 'write', handler: writeAgent },
  ],
})
```

---

## Skill 设计模式

### 什么是 Skill

Skill = Prompt 模板 + 工具调用策略 + 触发条件 + 工作流逻辑

不是一个新的概念，而是把已有的 Agent 能力**封装成可复用的"技能包"**。

### Skill vs Tool vs MCP Server

| | Tool | Skill | MCP Server |
|------|------|-------|-----------|
| 粒度 | 单个操作（查天气） | 完整任务流程（写周报） | 能力集合（文件系统） |
| 复杂度 | 低 | 中-高 | 中 |
| 包含 Prompt | 无 | 有 | 无（由 Client 提供） |
| 可复用性 | 跨 Agent | 跨 Agent/跨产品 | 跨 Agent/跨产品 |

### Skill 的完整结构

```
skill: planning-with-files
├── 触发条件：用户说"帮我计划一下"
├── 输入：任务描述文本
├── 执行流程：
│   1. 创建 task_plan.md（拆解任务）
│   2. 创建 progress.md（记录进度）
│   3. 创建 findings.md（收录发现）
├── 输出：三个已创建的 Markdown 文件
└── 后续使用：读取这些文件恢复上下文
```

---

## 练习

### 基础练习

1. 安装 Mastra（`pnpm add @mastra/core`），将第 11 章的网页搜索 Agent 用 Mastra 重写，对比代码行数差异
2. 对比 AI SDK 裸写和 Mastra 框架的代码：框架帮你省了哪些 boilerplate？多了哪些约束？
3. 分析 Qoder 的 `planning-with-files` Skill：它的触发条件、输入、执行流程、输出分别是什么？

### 进阶挑战

1. 用 Mastra Workflow 实现一个"研究-分析-写作"三步骤工作流，每个步骤由不同的 Agent 完成
2. 设计一个你自己的 Skill：定义触发条件、输入参数、执行流程和输出格式，写成 SKILL.md 格式

### 思考题

1. 框架的"自动化编排"在带来便利的同时，会损失什么？（提示：调试难度、黑盒问题、性能开销）
2. Skill 和传统的"函数封装"有什么区别？为什么 Skill 需要包含 Prompt 模板和触发条件？

---

## 实战建议（Day 19 任务指南）

1. **安装 Mastra**（5 分钟）
   ```bash
   cd stage-5-mastra && pnpm add @mastra/core
   ```

2. **用 Mastra 重写 Day 15 的 Agent**（15 分钟）
   - 对比用 AI SDK 裸写和用 Mastra 的代码行数差异
   - 体验 Mastra 的 Agent 定义方式

3. **理解 Skill 设计模式**（10 分钟）
   - 看 Qoder 的 SKILL.md 格式
   - 看 planning-with-files 的工作流
   - 思考：如果让我设计一个 Skill，它会做什么？

---

## 延伸阅读

| 资料 | 推荐理由 |
|------|---------|
| [Mastra 官方文档](https://mastra.ai/docs) | 📖 Mastra 框架文档 |
| [LangGraph.js 文档](https://langchain-ai.github.io/langgraphjs/) | 📖 状态机式 Agent 编排 |
| [Qoder Skills](https://qoder.com/docs/skills) | 📖 Skill 设计模式的实践参考 |

---

| [← 上一章：Agent 记忆系统（长期记忆）](../chapter13/) | [下一章：MCP 协议深入理解 →](../chapter15/) |
