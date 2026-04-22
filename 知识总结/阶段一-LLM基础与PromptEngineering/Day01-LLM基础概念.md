# Day 01 知识点总结：LLM 基础概念

> 阶段：阶段一 - LLM 基础认知 & Prompt Engineering

---

## 核心概念

| 概念 | 一句话定义 | 类比 |
|------|-----------|------|
| **Token** | LLM 处理文本的最小单位 | 英文≈0.75个词，中文≈1-2个字符 |
| **Context Window** | 模型一次能处理的 Token 上限 | 像人的短期记忆容量 |
| **Temperature** | 控制输出随机性的参数 | 0=保守确定，1=创意发散 |
| **Top-P** | 核采样，控制候选词范围 | 只从高概率词中选 |
| **Max Tokens** | 限制输出长度 | 防止生成过长内容 |

## 消息格式

- **System**：设定角色和行为规则
- **User**：用户输入
- **Assistant**：模型回复

## 关键实践

- 在 OpenAI Tokenizer 中观察中英文 Token 划分差异
- 对比 Temperature 0 vs 1 的输出差异
- 理解 `System` + `User` + `Assistant` 的消息结构

## 常见误区

❌ 认为 LLM "理解"了文本的含义  
✅ LLM 是基于概率预测下一个 Token，没有真正的"理解"

## 一句话总结

> LLM 不是"理解"文本，而是基于概率预测下一个 Token。

## 关联知识点

- **后置**：[Day 2（Prompt Engineering）](Day02-PromptEngineering核心技巧.md)
