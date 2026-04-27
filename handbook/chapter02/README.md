# 第 2 章：Prompt Engineering 实战

> 本章目标：掌握 Prompt 的核心技巧——不只是"写好提示词"，而是"让模型按你需要的方式工作"。
> 对应学习计划：Day 2

---

## 概念速览

### 什么是 Prompt Engineering

本质不是"写优美的提示词"，而是**用模型能理解的方式精确描述你的需求**。

四种核心技巧：

| 技巧 | 是什么 | 适用场景 |
|------|--------|---------|
| **角色设定** | 通过 System Prompt 定义模型的"人设" | 所有场景，尤其是需要特定领域知识的 |
| **Few-shot** | 给 2-3 个输入→输出的示例，让模型模仿格式 | 格式类任务（分类、翻译、提取） |
| **Chain of Thought (CoT)** | 要求模型"一步步思考"再回答 | 推理、数学、逻辑判断 |
| **结构化输出** | 让模型返回 JSON/约定格式的数据 | 数据提取、API 对接、自动化流程 |

### 各种技巧怎么选

```
需要推理/逻辑判断 → CoT
需要特定的输出格式 → Few-shot 或 结构化输出
需要改变模型的"语气/定位" → 角色设定
需要保证输出符合 Schema → 结构化输出（下一章用 Zod 实现）
```

### 一句话总结

> Prompt Engineering 的本质不是"写好提示词"，而是用模型能理解的方式精确描述需求。角色设定定方向，Few-shot 定格式，CoT 定推理，结构化输出定数据。

---

## 技术选型

### 在哪里练习

| 平台 | 适用场景 |
|------|---------|
| ChatGPT (GPT-4o) | 通用练习，生态最全 |
| Claude (Sonnet/Opus) | Prompt 理解和遵循能力更强，适合对比测试 |
| DeepSeek Chat | 成本最低，练习用无压力 |

### 调试 Prompt 的工具

- **ChatGPT Playground**：对比多个 Prompt 效果最方便
- **Anthropic Console**：有 Prompt 生成器和评估工具

⚠️ Day 2 阶段不需要 SDK，直接在 Web 聊天界面练习即可。API 集成从 Day 3 开始。

---

## 代码骨架

Day 2 是手动实验阶段，不需要代码。但你可以提前看 Day 3 会用的骨架：

```typescript
// Day 3 会这样用 System Prompt（目前只需了解概念）
import { generateText } from 'ai'
import { qwen } from 'shared-utils'

const result = await generateText({
  model: qwen('qwen3-max'),
  system: '你是一名前端架构师。回答问题要：1. 先给结论；2. 再说原因；3. 最后给代码示例。',
  messages: [{ role: 'user', content: 'React 中 useMemo 和 useCallback 的区别是什么？' }],
})
```

---

## 实战建议（Day 2 任务指南）

按顺序做 4 个实验（每个 15-20 分钟）：

### 实验 1：角色设定对比

```
无 System Prompt：
  "解释 React 的 Virtual DOM"

有 System Prompt：
  System: "你是一名前段架构师，擅长用比喻解释技术概念。
          回答要求：1. 用生活化的比喻；2. 不超过 200 字；3. 必须提到优缺点"
  User: "解释 React 的 Virtual DOM"
```

对比两个回答的风格、深度、结构差异。

### 实验 2：Few-shot 格式控制

```
System: "你将收到一段产品文字，提取为 JSON 格式"
User:
  "输入：iPhone 15 Pro，钛金属设计，¥8999，6.1寸屏幕
   输出：{name:'iPhone 15 Pro', price:8999, screen:'6.1寸', material:'钛金属'}

   输入：MacBook Air M3，铝合金机身，¥10499，13.6寸屏幕
   输出：{name:'MacBook Air M3', price:10499, screen:'13.6寸', material:'铝合金'}

   输入：华为 Mate 60 Pro，昆仑玻璃，¥6999，6.82寸屏幕"
```

观察模型是否严格复制你给的输出格式、key 名。

### 实验 3：CoT 推理

```
不带 CoT：
  "小明有 5 个苹果，给了小红 2 个，又买了 3 个，再给小刚 2 个。小明还有几个苹果？"

带 CoT：
  "小明有 5 个苹果，给了小红 2 个，又买了 3 个，再给小刚 2 个。小明还有几个苹果？
   请一步步思考，每步写出当前状态。"
```

CoT 对 GPT-4o-mini 等小模型的提升尤其明显。

### 实验 4：跨模型对比

用同一个 Prompt（推荐实验 2 的 Few-shot）分别发给 GPT-4o 和 Claude，观察：
- 谁更严格遵循格式？
- 谁对中文理解更好？
- 谁的结果更稳定（多试几次）？

---

## 踩坑记录

✅ **坑 1：Few-shot 示例数量不是越多越好**
给 2-3 个示例效果最好。给 5+ 个反而可能让模型"过拟合"示例，不敢变通。
→ **实战规律**：2-3 个优质示例 > 5 个随意示例。

✅ **坑 2：CoT 对简单问题反而有害**
"1+1 等于几？一步步思考" —— 模型可能开始瞎编推理过程。
→ **怎么绕**：自然语言里你能凭直觉回答的问题，不需要 CoT；需要计算/推理的才用。

---

## 练习

### 基础练习
1. 写一个有明确角色的 System Prompt（如"你是一名前端架构师"），用同一个问题对比有无角色设定的回答差异
2. 用 Few-shot 让模型按指定 JSON 格式提取信息（给 2 个示例后测试第 3 个输入）
3. 对比同一道数学题带 CoT（"请一步步思考"）和不带 CoT 的准确率，用小模型（如 gpt-4o-mini）测试效果更明显

### 进阶挑战
1. 设计一个复合 Prompt：同时包含角色设定 + Few-shot + CoT，让模型完成一个复杂任务（如"分析代码 bug 并给出修复建议"）
2. 用不同模型（GPT-4o vs Claude vs DeepSeek）测试同一个 Few-shot Prompt，记录谁更严格遵循输出格式

### 思考题
1. Few-shot 给 1 个示例和给 5 个示例，效果会有什么不同？为什么不是越多越好？
2. 如果模型没有严格遵循你给的输出格式，你会优先调整 Prompt 的哪个部分？为什么？

---

## 延伸阅读

| 资料 | 推荐理由 |
|------|---------|
| [OpenAI Prompt Engineering Guide](https://platform.openai.com/docs/guides/prompt-engineering) | 📖 官方指南，最权威 |
| [Anthropic Prompt Engineering](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering) | 📖 Claude 的提示词最佳实践，方法论通用 |
| [Prompt Engineering Guide (DAIR.AI)](https://www.promptingguide.ai/zh) | 📖 社区维护的全面中文指南，涵盖 CoT/ToT/ReAct 等高级技巧 |

---

| [← 上一章：理解大语言模型](../chapter01/README.md) | [下一章：Vercel AI SDK 核心 API →](../chapter03/README.md) |
