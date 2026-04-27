# 第 12 章：Agent 记忆系统（短期记忆）

> 本章目标：理解 Agent 记忆系统的必要性，掌握三种短期记忆模式（Buffer/Window/Summary）的实现和适用场景。
> 对应学习计划：Day 16

---

## 概念速览

### 为什么 Agent 需要记忆系统

普通 LLM 对话中的 `messages` 数组天然包含完整对话历史。但在 Agent 场景下，每一次新增消息都会占用 Token，很快就超出上下文窗口限制。更何况，Agent 还需要跨多次对话记住用户偏好、关键信息等。

```
不带记忆的 Agent：
  用户："帮我找个 React 性能优化的文章"
  Agent: 搜索 → 返回结果

  用户："刚才那篇讲的什么？"  ← Agent 可能忘了

带记忆的 Agent：
  Agent 在第一次交互中记住：用户关注 React 性能优化，偏好中文资料
  后续对话可以直接引用此记忆
```

### 上下文 vs 记忆（容易混淆）

| | 上下文（Context） | 记忆（Memory） |
|------|------|------|
| 内容 | 当前对话的 `messages` | 从对话中提取的关键信息 |
| 生命周期 | 仅当次对话 | 可跨会话持久化 |
| Token 消耗 | 每条消息都占 Token | 只占极少 Token（摘要/要点） |
| 管理方式 | append / 截断 | 提取、压缩、检索 |

### 三种短期记忆模式

| 模式 | 原理 | Token 消耗 | 信息保留 | 适用场景 |
|------|------|-----------|---------|---------|
| **Buffer Memory** | 保留完整 `messages` | 线性增长 | 100% | 短对话（<10 轮） |
| **Window Memory** | 只保留最近 K 轮 | 固定 | 最近一段 | 一般对话 |
| **Summary Memory** | LLM 压缩早期对话为摘要 | 受控 | 要点 | 长对话 |

### 双重历史设计（生产级模式）

```typescript
// fullHistory → 完整对话数组（用户可见的历史）
// messagesForLLM → 传给模型的数组（智能压缩后的版本）

fullHistory:        [msg1, msg2, msg3, msg4, msg5, msg6, msg7, msg8]
                        ↓ Memory Manager（压缩/截断）
messagesForLLM:    [摘要(msg1-4), msg5, msg6, msg7, msg8]
```

---

## 一句话总结

短期记忆解决上下文窗口限制。Buffer 保留全部但 Token 线性增长，Window 固定消耗但会丢早期内容，Summary 压缩历史但需额外 LLM 调用。生产环境用"双重历史"：用户看完整的，模型看压缩的。

---

## 代码骨架

### 1. Buffer Memory（保留一切，Token 满则截断）

```typescript
// stage-5-agent/05-buffer-memory.ts
let messages: ModelMessage[] = []

function estimateTokens(msgs: ModelMessage[]): number {
  // 简单估算：每 2 个字符约 1 Token（中文 ~1.5）
  return msgs.reduce((sum, m) => sum + m.content.length / 2, 0)
}

async function chat(userInput: string) {
  messages.push({ role: 'user', content: userInput })

  // Token 快超出上下文窗口时，截掉最早的消息
  const MAX_TOKENS = 30000
  while (estimateTokens(messages) > MAX_TOKENS && messages.length > 2) {
    messages = messages.slice(2) // 保留 system 消息，成对删除
  }

  const result = await generateText({ model, messages })
  messages.push({ role: 'assistant', content: result.text })

  // 打印精确 Token 用量
  console.log(`Total tokens: ${result.usage.totalTokens}`)
}
```

### 2. Window Memory（滑动窗口，只保留最近 K 轮）

```typescript
// stage-5-agent/07-window-memory.ts
const WINDOW_SIZE = 5 // 保留最近 5 轮对话

function getWindowMessages(fullHistory: ModelMessage[]): ModelMessage[] {
  // 始终保留 system 消息
  const systemMsgs = fullHistory.filter(m => m.role === 'system')
  const convoMsgs = fullHistory.filter(m => m.role !== 'system')

  // 取最近的 WINDOW_SIZE * 2 条（每轮 = user + assistant）
  const recent = convoMsgs.slice(-(WINDOW_SIZE * 2))

  return [...systemMsgs, ...recent]
}
```

### 3. Summary Memory（LLM 自动摘要压缩）

```typescript
// stage-5-agent/06-summary-memory.ts
const SUMMARY_AFTER = 6 // 超过 6 轮对话后开始摘要

let conversationSummary = ''

async function compressHistory(messages: ModelMessage[]) {
  const recentMessages = messages.slice(-4) // 保留最近 2 轮
  const oldMessages = messages.slice(0, -4)   // 更早的对话

  // 用 LLM 将早期对话压缩为 200 字摘要
  const { text: summary } = await generateText({
    model: qwen('qwen-turbo'), // 摘要用便宜模型即可
    prompt: `将以下对话历史压缩为 200 字以内的摘要：\n${oldMessages.map(m => `${m.role}: ${m.content}`).join('\n')}`,
  })

  conversationSummary = summary // 用摘要替换早期对话
}

// 后续传给 LLM 的消息：
const systemMsg = `之前的对话摘要：${conversationSummary}`
const messagesForLLM = [
  { role: 'system', content: systemMsg },
  ...recentMessages, // 加上最近的对话
]
```

---

## 实战建议（Day 16 任务指南）

1. **理解内存模式**（10 分钟）
   - 看 LangChain Memory 概念文档（概念通用，不一定要用 LangChain）
   - 理解 Buffer/Window/Summary 各自适合什么场景

2. **写 05-buffer-memory.ts**（15 分钟）
   - 维护完整 messages 数组
   - 实现 Token 估算和自动截断

3. **写 07-window-memory.ts**（10 分钟）
   - 窗口大小设为 3 和 10 分别测试
   - 观察：窗口太小时，模型是否会"忘掉"早期话题

4. **写 06-summary-memory.ts**（15 分钟）
   - 超过 6 轮后调用 LLM 生成摘要
   - 摘要是累积的（每次追加新的要点）
   - 测试 10+ 轮对话后，问"我们之前聊过什么？"

---

## 练习

### 基础练习

1. 实现 `05-buffer-memory.ts`：维护完整 `messages` 数组，实现 Token 估算函数，当接近上限时成对删除最早的消息对
2. 实现 `07-window-memory.ts`：分别设置 `WINDOW_SIZE = 3` 和 `WINDOW_SIZE = 10`，进行 8 轮对话后问"我们第一轮聊了什么"，观察不同窗口大小的"遗忘"差异
3. 实现 `06-summary-memory.ts`：超过 6 轮后用 `qwen-turbo` 生成摘要，测试 10+ 轮后问"我们之前聊过什么"，验证摘要是否保留了关键信息

### 进阶挑战

1. 实现"动态窗口"：根据问题复杂度自动调整窗口大小（简单问题 K=3，复杂推理 K=10）
2. 实现"累积摘要"：每次摘要不是替换旧的，而是将新摘要与旧摘要合并，避免早期信息完全丢失

### 思考题

1. Buffer Memory 的 Token 估算公式（字符数/2）和实际 API 返回的 `usage.totalTokens` 差距有多大？为什么？
2. Summary Memory 中，用便宜模型（qwen-turbo）做摘要、贵模型（qwen3-max）做对话，成本能省多少？计算一个 20 轮对话的示例。

---

## 踩坑记录

✅ **坑 1：Summary Memory 的摘要模型可以比主对话模型便宜**
摘要用 `qwen-turbo`（¥0.3/百万 Token），对话用 `qwen3-max`（¥2/百万 Token）。能省 6 倍成本。
→ **设计模式**：不同任务用不同价格的模型。

✅ **坑 2：Window Memory 窗口大小选择**
- K=3：节省 Token，但容易丢上下文
- K=10：保留更多上下文，但消耗大量 Token
→ **怎么绕**：动态窗口 — 简单问题用 K=3，复杂推理用 K=10

✅ **坑 3：Token 估算公式**

```
英文：字符数 / 4 ≈ Token 数
中文：字符数 / 1.5 ≈ Token 数
混合：用 1/4 和 1.5 加权平均

精确值：只有 API 调用返回的 result.usage.totalTokens 是准的
```

---

## 延伸阅读

| 资料 | 推荐理由 |
|------|---------|
| [LangChain Memory 概念](https://js.langchain.com/docs/concepts/memory) | 📖 记忆模式分类讲解（概念通用） |
| [Anthropic 上下文窗口管理](https://docs.anthropic.com/en/docs/build-with-claude/context-windows-and-tokens) | 📖 上下文窗口管理最佳实践 |
| 本仓库 `stage-5-agent/05-buffer-memory.ts` | ✅ Buffer Memory 实现（交互式） |
| 本仓库 `stage-5-agent/06-summary-memory.ts` | ✅ Summary Memory 实现（交互式） |
| 本仓库 `stage-5-agent/07-window-memory.ts` | ✅ Window Memory 实现（交互式） |

---

| [← 上一章：构建实用 Agent](../chapter11/README.md) | [下一章：Agent 记忆系统（长期记忆）→](../chapter13/README.md) |
