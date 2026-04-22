# Day 05 知识点总结：结构化输出 + Ollama 本地模型

> 阶段：阶段二 - LLM API 集成开发（TypeScript）

---

## 核心概念

- **结构化输出**：让 LLM 返回符合 Schema 的数据（AI SDK v6 用 `Output.object`，`generateObject` 已废弃）
- **Zod Schema**：TypeScript 运行时类型验证，定义输出格式
- **Ollama**：本地运行开源 LLM 的工具

## 关键代码模式

```typescript
import { generateText, Output } from 'ai';
import { z } from 'zod';

const schema = z.object({
  title: z.string(),
  summary: z.string(),
  keywords: z.array(z.string()),
  sentiment: z.enum(['positive', 'negative', 'neutral']),
});

const result = await generateText({
  model: openai('gpt-4o-mini'),
  prompt: '分析这段新闻...',
  output: Output.object({ schema }),
});

console.log(result.object); // 符合 Schema 的结构化数据
```

## Ollama 使用

```bash
ollama serve              # 启动服务
ollama pull qwen3:8b      # 拉取模型
```

## 实践要点

- Zod Schema 越详细，输出越稳定
- 本地模型（qwen3:8b）vs 云端 API：速度更快但质量稍弱
- 结构化输出是 Agent 开发的基础（工具参数需要结构化）

## 常见误区

❌ 用自然语言描述期望的 JSON 格式  
✅ 用 Zod Schema 精确定义字段类型和约束

## 一句话总结

> 结构化输出 = Prompt + Zod Schema，让模型从"自由写作"变为"填表格"。

## 关联知识点

- **前置**：[Day 4（流式输出 + 多轮对话）](Day04-流式输出与多轮对话.md)
- **后置**：[Day 6（Chat Web 应用搭建）](../../阶段三-构建AI_Chat_Web应用/Day06-项目搭建与基础聊天UI.md)
