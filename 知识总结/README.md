# AI 学习知识点总结

> 按天拆分的知识点文档，按阶段组织
> 每篇包含：核心概念、关键代码、实践要点、常见误区、一句话总结

---

## 目录结构

```
知识总结/
├── README.md
├── 阶段一-LLM基础与PromptEngineering/
│   ├── Day01-LLM基础概念.md
│   └── Day02-PromptEngineering核心技巧.md
│
├── 阶段二-LLM_API集成开发/
│   ├── Day03-Vercel_AI_SDK入门.md
│   ├── Day04-流式输出与多轮对话.md
│   └── Day05-结构化输出与Ollama.md
│
├── 阶段三-构建AI_Chat_Web应用/
│   ├── Day06-项目搭建与基础聊天UI.md
│   ├── Day07-消息渲染优化.md
│   ├── Day08-多模型切换与UI完善.md
│   └── Day09-对话历史持久化.md
│
├── 阶段四-RAG检索增强生成/
│   ├── Day10-RAG与Embedding基础.md
│   ├── Day11-文档分块与向量存储.md
│   ├── Day12-RAG检索与问答.md
│   └── Day13-RAGWeb界面.md
│
└── 阶段五-Agent开发核心/
    ├── Day14-Agent与ToolCalling基础.md
    ├── Day15-构建实用Agent.md
    └── Day16-Agent记忆系统-短期记忆.md
```

### 快速导航

- [Day 1（LLM 基础概念）](./阶段一-LLM基础与PromptEngineering/Day01-LLM基础概念.md)
- [Day 2（Prompt Engineering）](./阶段一-LLM基础与PromptEngineering/Day02-PromptEngineering核心技巧.md)
- [Day 3（Vercel AI SDK 入门）](./阶段二-LLM_API集成开发/Day03-Vercel_AI_SDK入门.md)
- [Day 4（流式输出 + 多轮对话）](./阶段二-LLM_API集成开发/Day04-流式输出与多轮对话.md)
- [Day 5（结构化输出 + Ollama）](./阶段二-LLM_API集成开发/Day05-结构化输出与Ollama.md)
- [Day 6（项目搭建 + 基础聊天 UI）](./阶段三-构建AI_Chat_Web应用/Day06-项目搭建与基础聊天UI.md)
- [Day 7（消息渲染优化）](./阶段三-构建AI_Chat_Web应用/Day07-消息渲染优化.md)
- [Day 8（多模型切换 + UI 完善）](./阶段三-构建AI_Chat_Web应用/Day08-多模型切换与UI完善.md)
- [Day 9（对话历史持久化）](./阶段三-构建AI_Chat_Web应用/Day09-对话历史持久化.md)
- [Day 10（RAG + Embedding 基础）](./阶段四-RAG检索增强生成/Day10-RAG与Embedding基础.md)
- [Day 11（文档分块 + 向量存储）](./阶段四-RAG检索增强生成/Day11-文档分块与向量存储.md)
- [Day 12（RAG 检索 + 问答）](./阶段四-RAG检索增强生成/Day12-RAG检索与问答.md)
- [Day 13（RAG Web 界面）](./阶段四-RAG检索增强生成/Day13-RAGWeb界面.md)
- [Day 14（Agent + Tool Calling）](./阶段五-Agent开发核心/Day14-Agent与ToolCalling基础.md)
- [Day 15（构建实用 Agent）](./阶段五-Agent开发核心/Day15-构建实用Agent.md)
- [Day 16（Agent 记忆系统 - 短期记忆）](./阶段五-Agent开发核心/Day16-Agent记忆系统-短期记忆.md)

---

## 学习路径速览

| 阶段 | 天数 | 核心能力 | 产出物 |
|------|------|---------|--------|
| **阶段一** | Day 1-2 | 理解 LLM 原理 + Prompt Engineering | Prompt 实验记录 |
| **阶段二** | Day 3-5 | TypeScript 调用 LLM API | 5 个可运行脚本 |
| **阶段三** | Day 6-9 | 构建 Chat Web 应用 | Next.js 聊天应用 |
| **阶段四** | Day 10-13 | RAG 检索增强生成 | 文档问答系统 |
| **阶段五** | Day 14-19 | Agent + 记忆系统 | 智能体应用 |

---

## 快速复习检查清单

### 阶段一
- [ ] 能解释 Token、Context Window、Temperature
- [ ] 能写出带 Few-shot 和 CoT 的 Prompt

### 阶段二
- [ ] 能用 `generateText` 调用 API 并打印 usage
- [ ] 能用 `streamText` 实现流式输出
- [ ] 能用 Zod Schema 让模型返回结构化数据

### 阶段三
- [ ] 能用 `useChat` + Route Handler 搭建聊天应用
- [ ] 能渲染 Markdown 和代码高亮
- [ ] 能实现多模型切换
- [ ] 能用 localStorage 持久化对话历史

### 阶段四
- [ ] 能解释 RAG 流程并计算余弦相似度
- [ ] 能实现文档分块和 Embedding 存储
- [ ] 能实现向量搜索 + RAG 问答
- [ ] 能把 RAG 整合到 Web 聊天界面

### 阶段五
- [ ] 能用 Tool Calling 实现 ReAct 模式
- [ ] 能构建带搜索/查询功能的实用 Agent
- [ ] 能实现 Buffer / Window / Summary 三种记忆

---

## 使用建议

1. **每日学习后**：回顾对应 Day 的总结，确认核心概念已掌握
2. **阶段结束时**：用"快速复习检查清单"自测
3. **忘记时**：直接搜索对应 Day 的文档，比翻学习计划快得多
4. **写代码时**：复制"关键代码模式"作为起点

---

> **更新日期**：2026-04-22  
> **当前进度**：Day 1-16 已完成总结
