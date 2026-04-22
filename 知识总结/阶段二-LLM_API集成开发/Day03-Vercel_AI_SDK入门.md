# Day 03 知识点总结：Vercel AI SDK 入门 + 第一次 API 调用

> 阶段：阶段二 - LLM API 集成开发（TypeScript）

---

## 核心概念

- **Vercel AI SDK**：前端开发者友好的 LLM 调用库，一套代码适配多个模型
- **Provider 模式**：`@ai-sdk/openai`、`@ai-sdk/anthropic` 等，切换模型只需改一行
- **generateText**：最基础的文本生成 API

## 关键代码模式

```typescript
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const result = await generateText({
  model: openai('gpt-4o-mini'),
  prompt: '你好',
});

console.log(result.text);      // 生成的文本
console.log(result.usage);     // Token 用量（计费依据）
```

## 实践要点

- API Key 必须放在 `.env`，**不要硬编码**
- `result.usage` 包含 `promptTokens` + `completionTokens` = `totalTokens`
- DeepSeek 兼容 OpenAI 格式，用 `@ai-sdk/openai` 即可

## 项目初始化

```bash
mkdir ~/ai-learning/stage-2-api && cd ~/ai-learning/stage-2-api
pnpm init
pnpm add ai @ai-sdk/openai @ai-sdk/anthropic zod dotenv tsx
```

## 常见误区

❌ 把 API Key 写在代码里提交到 Git  
✅ 用 `.env` + `.gitignore` 保护密钥

## 一句话总结

> `generateText` = 给模型一个 prompt，它返回一段文本 + Token 用量。

## 关联知识点

- **前置**：[Day 2（Prompt Engineering）](../../阶段一-LLM基础与PromptEngineering/Day02-PromptEngineering核心技巧.md)
- **后置**：[Day 4（流式输出 + 多轮对话）](Day04-流式输出与多轮对话.md)
