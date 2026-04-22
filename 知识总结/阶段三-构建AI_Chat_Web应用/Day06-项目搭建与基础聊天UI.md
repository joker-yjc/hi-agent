# Day 06 知识点总结：项目搭建 + 基础聊天 UI

> 阶段：阶段三 - 构建 AI Chat Web 应用

---

## 核心概念

- **Next.js 15 App Router**：路由即文件系统，`app/api/chat/route.ts` = `/api/chat`
- **useChat Hook**：Vercel AI SDK 提供的 React Hook，封装了聊天状态管理
- **Route Handler**：Next.js 的 API 路由，后端逻辑写在这里

## 关键代码模式

### 后端 API Route

```typescript
// app/api/chat/route.ts
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function POST(req: Request) {
  const { messages } = await req.json();
  
  const result = await streamText({
    model: openai('gpt-4o-mini'),
    messages,
  });
  
  return result.toDataStreamResponse();
}
```

### 前端页面

```typescript
// page.tsx
import { useChat } from 'ai/react';

export default function ChatPage() {
  const { messages, input, handleInputChange, handleSubmit } = useChat();
  
  return (
    <div>
      {messages.map(m => (
        <div key={m.id} className={m.role}>
          {m.content}
        </div>
      ))}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
      </form>
    </div>
  );
}
```

## 实践要点

- `useChat` 自动处理：消息状态、发送请求、流式渲染
- Route Handler 返回 `toDataStreamResponse()` 实现流式传输
- 前端区分用户/AI 消息用 `m.role`

## 项目初始化

```bash
cd ~/ai-learning
pnpm create next-app@latest stage-3-chat-app --typescript --tailwind --app --src-dir
cd stage-3-chat-app
pnpm add ai @ai-sdk/openai
```

## 一句话总结

> `useChat` + Route Handler = 最小可用的 AI Chat 应用。

## 关联知识点

- **前置**：[Day 5（结构化输出 + Ollama）](../../阶段二-LLM_API集成开发/Day05-结构化输出与Ollama.md)
- **后置**：[Day 7（消息渲染优化）](Day07-消息渲染优化.md)
