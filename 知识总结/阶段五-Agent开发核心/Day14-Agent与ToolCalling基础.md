# Day 14 知识点总结：Agent + Tool Calling 基础

> 阶段：阶段五 - Agent 开发核心（含记忆系统）

---

## 核心概念

- **Agent**：LLM + 工具 + 循环决策
- **ReAct 模式**：Reasoning（推理）+ Acting（行动），Thought → Action → Observation 循环
- **Tool Calling**：LLM 决定调用哪个工具、传什么参数
- **maxSteps**：允许的最大推理步数

## Agent 推理模式对比

| 模式 | 核心 | 适用场景 |
|------|------|---------|
| **ReAct** | 边想边做 | 需要外部工具的复杂任务 |
| **CoT** | 分步推理 | 数学、逻辑问题 |
| **ToT** | 多路径探索 | 复杂规划、创意生成 |
| **RefleXion** | 自我反思 | 代码生成、持续改进 |

## 关键代码模式

```typescript
import { generateText, tool } from 'ai';

const getWeather = tool({
  description: '获取指定城市的天气信息',
  parameters: z.object({ city: z.string() }),
  execute: async ({ city }) => {
    const res = await fetch(`https://wttr.in/${city}?format=j1`);
    return res.json();
  },
});

const result = await generateText({
  model: openai('gpt-4o'),
  messages: [{ role: 'user', content: '北京天气怎么样？' }],
  tools: [getWeather],
  maxSteps: 5, // 最多 5 步推理
});
```

## ReAct 循环流程

```
用户输入 → LLM 思考（需要工具？）→ 调用工具 → 观察结果 → 
→ LLM 再思考（还需要工具？）→ ... → 生成最终回答
```

## 实践要点

- `description` 很重要，LLM 靠它决定什么时候调用工具
- `parameters` 用 Zod Schema 定义，LLM 会自动生成符合 schema 的参数
- `maxSteps` 防止无限循环，通常设 5-10

## 常见误区

❌ 工具描述写得模糊  
✅ 工具 description 要像写给产品经理一样清晰

## 一句话总结

> Agent = 给 LLM 配备工具，让它自己决定什么时候调用、调用什么。

## 关联知识点

- **前置**：[Day 13（RAG Web 界面）](../../阶段四-RAG检索增强生成/Day13-RAGWeb界面.md)
- **后置**：[Day 15（构建实用 Agent）](Day15-构建实用Agent.md)
