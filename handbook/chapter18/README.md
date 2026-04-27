# 第 18 章：成本控制与 Token 优化

> 本章目标：理解 LLM 调用的成本结构，掌握在不降质量的前提下控制花费的实用技巧。
> 对应学习计划：Day 28
> 🚧 本章内容基于官方文档和公开定价整理，具体价格请以各厂商实时公告为准。

---

## 概念速览

### Token 就是钱

LLM API 按 **Token 数量** 计费。1 Token ≈ 4 个英文字符 ≈ 1-2 个中文字符（实际取决于模型的 Tokenizer）。

```
费用公式：
  总费用 = (输入 Token × 输入单价) + (输出 Token × 输出单价)
```

关键认知：**输入输出是分别计费的**，且多数模型输出 Token 比输入 Token 贵 2-4 倍。

### 各模型价格差距有多大

截至 2026 年初的大致量级对比（以每百万 Token 计）：

| 模型 | 输入价格 | 输出价格 | 质量定位 |
|------|---------|---------|---------|
| gpt-4o | ~$2.5 | ~$10 | 旗舰 |
| gpt-4o-mini | ~$0.15 | ~$0.6 | 轻量 |
| deepseek-chat | ~¥1 | ~¥2 | 性价比 |
| qwen-turbo | ~¥0.3 | ~¥0.6 | 低成本 |
| qwen-max | ~¥2 | ~¥6 | 高质量 |
| ollama (本地) | 免费 | 免费 | 需要 GPU |

⚠️ 以上价格仅供量级感知，请以各厂商官网实时定价为准。

### 容易混淆的概念

| 概念 | 含义 | 影响成本的方式 |
|------|------|--------------|
| Context Window | 模型支持的最大 Token 总量 | 窗口大≠必须用满，实际花的是你发的 Token |
| Max Tokens | 限制输出长度 | 设小了省钱但可能截断回答 |
| Temperature | 采样随机性 | 不影响 Token 数，但影响重试次数 |

---

## 技术选型

### 前端场景的成本优化策略

```
策略优先级（从高到低）：

1. 模型路由 — 简单问题用小模型，复杂问题用大模型
   → 效果最大，能降 70-90% 成本
   → 实现复杂度：中

2. Prompt 精简 — 去掉冗余指令，压缩 System Prompt
   → 效果中等，能降 20-50%
   → 实现复杂度：低

3. 上下文裁剪 — 只保留最近 N 条对话，早期对话用摘要替代
   → 效果中等，尤其在多轮对话中
   → 已在第 12 章记忆系统中实现

4. 缓存命中 — 相同 Prompt 直接返回缓存结果
   → 效果视重复率而定
   → Prompt 缓存（Prompt Caching）是部分厂商支持的特性
```

### Token 计数工具

| 工具 | 用途 | 来源 |
|------|------|------|
| OpenAI Tokenizer（网页版） | 可视化看 Token 切分 | https://platform.openai.com/tokenizer |
| `gpt-tokenizer` npm 包 | 代码中精确计数 | https://www.npmjs.com/package/gpt-tokenizer |
| AI SDK `usage` 字段 | 每次调用后直接读取实际用量 | AI SDK generateText/streamText 返回值 |

---

## 代码骨架

### 1. 读取 AI SDK 的 Token 用量

思路：AI SDK 的 `generateText` / `streamText` 返回值中自带 `usage` 字段，直接读即可。

```typescript
import { generateText } from 'ai'
import { qwen } from 'shared-utils'

const result = await generateText({
  model: qwen('qwen-turbo'),
  prompt: '用一句话解释什么是 React Hooks',
})

// 思路：usage 是 AI SDK 内置的标准字段，所有 Provider 都支持
console.log(result.usage)
// → { promptTokens: 12, completionTokens: 45, totalTokens: 57 }
```

### 2. 简易模型路由

思路：根据用户输入的长度或关键词判断"复杂度"，简单的走便宜模型，复杂的走贵模型。这是最粗糙但也最有效的策略。

```typescript
import { generateText } from 'ai'
import { qwen } from 'shared-utils'

/**
 * 思路：先用简单规则（长度 + 关键词）做路由
 * 后续可以升级为：用一个小模型做意图分类，再路由到对应模型
 */
function selectModel(userMessage: string): string {
  // 简单规则：长输入 / 包含"分析""对比""设计"等词 → 用大模型
  const complexKeywords = ['分析', '对比', '设计', '解释原理', '详细']
  const isComplex =
    userMessage.length > 200 ||
    complexKeywords.some(kw => userMessage.includes(kw))

  return isComplex ? 'qwen-max' : 'qwen-turbo'
  // 思路：qwen-turbo 价格约为 qwen-max 的 1/7
}

const userMsg = '什么是 useEffect？'
const modelId = selectModel(userMsg)

const result = await generateText({
  model: qwen(modelId),
  prompt: userMsg,
})

console.log(`模型: ${modelId}, Token: ${result.usage?.totalTokens}`)
```

### 3. 上下文裁剪（滑动窗口 + 摘要）

思路：多轮对话中，上下文越来越长，成本越来越高。用第 12 章的 Window Memory 策略截断，早期对话用摘要压缩。

```typescript
/**
 * 思路：保留最近 N 轮对话，超出部分生成一句摘要放在最前面
 * 这在第 12 章已经实现过，这里强调的是"成本视角"
 */
function pruneMessages(
  messages: Array<{ role: string; content: string }>,
  maxRounds: number = 5
): Array<{ role: string; content: string }> {
  if (messages.length <= maxRounds * 2) return messages

  // 思路：前面的消息压缩为一句系统摘要
  const earlyMessages = messages.slice(0, -(maxRounds * 2))
  const recentMessages = messages.slice(-(maxRounds * 2))

  const summaryHint = {
    role: 'system' as const,
    content: `[之前的对话摘要: 用户询问了 ${earlyMessages.length} 条消息，主要涉及的话题有...]`,
    // 思路：实际项目中这个摘要应该用 LLM 生成（参考第 12 章 06-summary-memory.ts）
  }

  return [summaryHint, ...recentMessages]
}
```

---

## 实战建议（Day 28 任务指南）

### 任务 1：编写 `01-token-counter.ts` — Token 计数实验

```
实现思路：
1. 用同一段 Prompt 分别调用 qwen-turbo 和 qwen-max
2. 打印两次调用的 usage 字段
3. 手动计算费用差异（查各模型的单价页面）
4. 对比：输出质量差多少？成本差多少？值不值？
```

### 任务 2：编写 `02-context-pruning.ts` — 上下文压缩

```
实现思路：
1. 模拟一个 20 轮对话的消息数组
2. 实现 pruneMessages 函数（保留最近 5 轮）
3. 分别用完整消息和裁剪后的消息调用 LLM
4. 对比：Token 消耗差异？回答质量差异？
```

### 任务 3：实现简单的模型路由

```
实现思路：
1. 准备 10 个不同复杂度的问题
2. 用 selectModel 函数自动路由
3. 统计路由结果：多少走了大模型、多少走了小模型
4. 估算：如果全走大模型 vs 路由后的总成本差异
```

---

## 踩坑记录

⚠️ **坑 1：Token 计数和费用不是同一回事**
`usage.totalTokens` 只是 Token 数量，不同模型的单价不同。100 Token 在 qwen-turbo 上花 ¥0.003，在 qwen-max 上花 ¥0.02。
→ **怎么绕**：自己写一个 `estimateCost(usage, modelId)` 函数，按模型查单价表。

⚠️ **坑 2：streamText 的 usage 要在流结束后才能读到**
流式响应过程中 `usage` 是 undefined，必须等流结束后从最终结果中读取。
→ **怎么绕**：用 `result.usage` 属性（它是一个 Promise），或在 `onFinish` 回调中读取。

⚠️ **坑 3：Prompt 缓存 (Prompt Caching) 不是所有厂商都支持**
Anthropic 的 Claude 支持 Prompt Caching（重复的 System Prompt 部分有折扣），但 OpenAI 和国内厂商的支持情况不一。
→ **怎么绕**：不要把 Prompt Caching 作为核心策略，当作锦上添花。

---

## 练习

### 基础练习
1. 调用 `generateText`，打印 `result.usage`，计算一次调用的实际费用
2. 分别用 `qwen-turbo` 和 `qwen-max` 回答同一个问题，对比 Token 数和回答质量

### 进阶挑战
1. 实现一个 `CostTracker` 类：每次 LLM 调用后自动累加费用，支持按模型分组统计
2. 在 Chat 应用的 route.ts 中加入模型路由逻辑：根据用户消息自动选择模型

### 思考题
1. 模型路由的"复杂度判断"本身可能出错（简单问题误判为复杂），这会导致什么后果？你会怎么兜底？
2. 如果你的 Chat 应用每天有 1000 次对话，平均每次 10 轮，每轮 500 Token，用 qwen-turbo 每月大概花多少钱？

---

## 延伸阅读

| 资料 | 推荐理由 |
|------|---------|
| [OpenAI Tokenizer](https://platform.openai.com/tokenizer) | 📖 可视化 Token 切分，直观感受"什么算一个 Token" |
| [阿里云百炼定价](https://help.aliyun.com/zh/model-studio/billing-overview) | 📖 qwen 系列模型的实时定价 |
| [DeepSeek 定价](https://platform.deepseek.com/api-docs/pricing/) | 📖 DeepSeek 模型的实时定价 |
| [Anthropic Prompt Caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) | 📖 Prompt 缓存机制详解 |
| [LiteLLM](https://github.com/BerriAI/litellm) | 📖 多模型统一路由 + 成本追踪的 Python 库（概念参考） |

---

| [← 上一章：综合项目实战与后续方向](../chapter17/README.md) | [下一章：多模态 — 图片理解 →](../chapter19/README.md) |
