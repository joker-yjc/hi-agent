# Day 04 知识点总结：流式输出 + 多轮对话

> 阶段：阶段二 - LLM API 集成开发（TypeScript）

---

## 核心概念

- **streamText**：流式生成，逐字输出（SSE 底层）
- **Messages 数组**：维护对话历史，实现多轮对话
- **SSE**：Server-Sent Events，服务器推送事件

## 关键代码模式

### 流式输出

```typescript
import { streamText } from 'ai';

const result = await streamText({
  model: openai('gpt-4o-mini'),
  prompt: '讲个故事',
});

for await (const chunk of result.textStream) {
  process.stdout.write(chunk); // 逐字打印
}
```

### 多轮对话

```typescript
const messages: CoreMessage[] = [];

async function chat(userInput: string) {
  messages.push({ role: 'user', content: userInput });
  
  const result = await generateText({
    model: openai('gpt-4o-mini'),
    messages, // 传入完整历史
    system: '你是一个前端技术顾问',
  });
  
  messages.push({ role: 'assistant', content: result.text });
  return result.text;
}
```

## 实践要点

- 流式输出用 `for await...of` 读取 `textStream`
- 多轮对话的核心是**维护 messages 数组**，每次调用都传入完整历史
- 可以用 `readline` 模块做命令行交互式聊天

## 常见误区

❌ 每次对话都新建 messages 数组  
✅ 需要持久化维护 messages 才能实现"记忆"

## 一句话总结

> 流式输出提升体验，messages 数组实现记忆。

## 关联知识点

- **前置**：[Day 3（Vercel AI SDK 入门）](Day03-Vercel_AI_SDK入门.md)
- **后置**：[Day 5（结构化输出 + Ollama）](Day05-结构化输出与Ollama.md)
