# 第 10 章：Agent 基础与 Tool Calling

> 本章目标：理解 Agent 的本质、ReAct 推理模式，掌握 Vercel AI SDK 中 Tool Calling 的基本用法。
> 对应学习计划：Day 14

---

## 概念速览

### 什么是 Agent

```
Agent = LLM + 工具 + 循环决策
```

普通 LLM：你问 → 它答（基于训练数据）
Agent：你问 → 它思考 → 确定需要工具 → 调用工具 → 观察结果 → 再思考 → ... → 生成最终回答

### Agent vs RAG

| 维度 | RAG | Agent |
|------|-----|-------|
| 核心能力 | 检索知识库内容 | 调用外部工具 + 多步推理 |
| 工具方式 | 单一（文档搜索） | 多种（搜索/计算/数据查询...） |
| 推理步骤 | 1 步（搜索 + 生成） | 多步（ReAct 循环） |
| 典型场景 | "文档里说了什么？" | "帮我查天气、算成本、发邮件" |

### ReAct 模式（Reasoning + Acting）

```
用户："北京天气适合户外运动吗？"

  Thought: 需要查天气 + 需要知道适合运动的温度范围
  Action: get_weather(city="北京")
  Observation: 晴，25°C，湿度 40%

  Thought: 25°C 适合运动，湿度合适，可以推荐
  Final Answer: "北京今天晴，25°C，非常适合户外运动！"
```

✅ **关键认知**：Agent 的核心能力不是"会调用工具"，而是"知道**什么时候**该调用、**调用哪个**、**怎么处理结果**"。

## 架构图：ReAct 循环

```
┌─────────────┐
│   用户输入   │
└──────┬──────┘
       ▼
┌─────────────┐     ┌──────────┐
│   Thought   │────→│ 需要调用  │
│  分析需求    │     │  工具？   │
└─────────────┘     └────┬─────┘
       ▲                 │
       │            ┌────┴────┐
       │            │         │
       │        否 ←┘         └─→ 是
       │            │              │
       │            ▼              ▼
       │      ┌─────────┐   ┌──────────┐
       │      │  Final  │   │  Action  │
       │      │ Answer  │   │ 调用工具  │
       │      └─────────┘   └────┬─────┘
       │                         ▼
       │                  ┌──────────┐
       └──────────────────│Observation│
                          │ 观察结果  │
                          └──────────┘
```

**单次调用 vs Agent 循环对比：**

```
普通 LLM 调用（1 步）：
  用户 → LLM → 回答

Agent ReAct 循环（多步）：
  用户 → Thought → Action(工具1) → Observation
              → Thought → Action(工具2) → Observation
              → Thought → Final Answer
```

### 常见推理模式对比

| 模式 | 核心 | 适用场景 |
|------|------|---------|
| **ReAct** | Thought → Action → Observation 循环 | 需要外部工具的复杂任务 |
| **CoT** (Chain of Thought) | 纯推理，不调工具，步骤推演 | 数学、逻辑问题 |
| **ToT** (Tree of Thought) | 多路径探索 + 回溯 | 复杂规划、创意生成 |
| **RefleXion** | 执行后自我反思修正 | 代码生成、持续改进 |

---

## 一句话总结

Agent = LLM + 工具 + 循环决策。ReAct 是核心推理模式：Thought → Action → Observation。`description` 的质量直接决定模型能否选对工具，`maxSteps` 防止无限循环。

---

## 技术选型

### Vercel AI SDK 的 Tool Calling

```typescript
import { generateText, tool } from 'ai'

const myTool = tool({
  description: '工具的描述（LLM 靠这个决定调不调用）',  // ← 最重要
  parameters: z.object({ /* 参数 Schema */ }),
  execute: async (params) => {
    // 实际执行逻辑
    return result
  },
})
```

### 关键参数

| 参数 | 作用 | 注意点 |
|------|------|--------|
| `tools` | 注册可用工具列表 | 最多 5-8 个，太多模型会迷惑 |
| `maxSteps` | 最大推理步数 | 防止无限循环，通常 5-10 |
| `toolChoice` | 强制/建议调用工具 | `'auto'`（默认）/ `'required'` / `'none'` |

---

## 代码骨架

### 1. 最简 Agent（单工具，5 行核心代码）

```typescript
// stage-5-agent/01-simple-tool.ts
import { generateText, tool } from 'ai'
import { z } from 'zod'
import { qwen } from 'shared-utils'

const getTime = tool({
  description: '获取当前时间',
  parameters: z.object({}),
  execute: async () => new Date().toLocaleString('zh-CN'),
})

const result = await generateText({
  model: qwen('qwen3-max'),
  tools: { getTime },
  maxSteps: 3,
  messages: [{ role: 'user', content: '现在几点了？' }],
})

console.log(result.text) // 模型会先调用 getTime 工具，再生成回答
// result.steps 可以看到每一步做了什么
```

### 2. 多工具 Agent（模型自主选择）

```typescript
// stage-5-agent/02-multi-tools.ts
const tools = {
  queryWeather: tool({
    description: '查询指定城市的天气。参数：city - 城市名称',
    parameters: z.object({ city: z.string() }),
    execute: async ({ city }) => ({ city, temp: 25, condition: '晴' }),
  }),
  calculate: tool({
    description: '执行数学计算。参数：expression - 数学表达式',
    parameters: z.object({ expression: z.string() }),
    execute: async ({ expression }) => eval(expression),
  }),
}

const result = await generateText({
  model: qwen('qwen3-max'),
  tools,
  maxSteps: 5,
  // 模型看到工具列表后，自己决定：
  // "北京天气" → 调 queryWeather
  // "100 * 25" → 调 calculate
})
```

### 3. 查看 Agent 的推理过程

```typescript
for (const step of result.steps) {
  console.log(`步骤 ${step.stepNumber}:`)
  console.log('  原因:', step.reasoning)
  console.log('  调用:', step.toolCalls.map(tc => tc.toolName))
  console.log('  结果:', step.toolResults.map(tr => tr.result))
}
```

---

## 实战建议（Day 14 任务指南）

1. **理解概念**（10 分钟）
   - 搞懂 ReAct 循环：Thought → Action → Observation
   - 分清 Agent 和普通 LLM 的区别

2. **写 01-simple-tool.ts**（15 分钟）
   - 定义 `getTime` 工具（照着骨架直接抄）
   - 用 `maxSteps: 3`，看模型用了几步
   - 打印 `result.steps` 看推理过程

3. **写 02-multi-tools.ts**（15 分钟）
   - 定义 3 个工具（天气、计算、摘要）
   - 测试不同问题，观察模型选择了哪个工具
   - 记录：description 写得好不好→直接影响模型的选择

---

## 练习

### 基础练习

1. 实现 `01-simple-tool.ts`：定义一个 `getTime` 工具，问模型"现在几点"，观察 `result.steps` 中的推理过程
2. 实现 `02-multi-tools.ts`：定义天气查询、数学计算、字符串反转三个工具，分别测试"北京天气""100*25""反转'hello'"，观察模型如何自主选择工具
3. 故意把 `queryWeather` 的 `description` 写得模糊（如"获取天气"），观察模型是否还会正确调用，体会 description 的重要性

### 进阶挑战

1. 实现一个"工具调用链"：模型先调用搜索工具获取信息，再调用计算工具处理数据，最后调用总结工具输出结果——观察 `maxSteps: 5` 是否能完成全链路
2. 用 `result.steps` 的数据实现一个"推理过程可视化"：在控制台打印每一步的 Thought、Action、Observation

### 思考题

1. ReAct 和 CoT 有什么区别？什么场景下 ReAct 优于 CoT，什么场景下反而不如？
2. 如果工具执行失败（如网络超时），模型会如何反应？如何设计让 Agent 更" resilient"？

---

## 踩坑记录

✅ **坑 1：`description` 写得太模糊**

```typescript
// ❌ 模糊
description: '获取天气'

// ✅ 精确
description: '查询指定城市的当前天气信息，包括温度、天气状况和湿度。参数 city 为中英文城市名称。'
```

LLM 靠 `description` 决定调不调用工具，描述要**像给产品经理写需求文档**一样清晰。

✅ **坑 2：`maxSteps` 设太小导致任务完不成**
需要先搜索再计算再总结的复合任务，`maxSteps: 2` 不够用。
→ **怎么绕**：一般设 5-10，根据任务复杂度调整。

---

## 延伸阅读

| 资料 | 推荐理由 |
|------|---------|
| [AI SDK Tool Calling 文档](https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling) | 📖 工具调用的完整 API 参考 |
| [AI SDK Agent 指南](https://sdk.vercel.ai/docs/guides/agents) | 📖 构建 Agent 的官方教程 |
| [ReAct 论文解读](https://www.promptingguide.ai/techniques/react) | 📖 ReAct 模式的深入讲解 |
| 本仓库 `stage-5-agent/01-simple-tool.ts` | ✅ 最简 Agent 示例 |
| 本仓库 `stage-5-agent/02-multi-tools.ts` | ✅ 多工具 Agent 示例 |

---

| [← 上一章：RAG 完整管道](../chapter09/README.md) | [下一章：构建实用 Agent →](../chapter11/README.md) |
