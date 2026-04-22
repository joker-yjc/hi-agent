# Day 02 知识点总结：Prompt Engineering 核心技巧

> 阶段：阶段一 - LLM 基础认知 & Prompt Engineering

---

## 核心概念

| 技巧 | 定义 | 适用场景 |
|------|------|---------|
| **角色设定** | 用 System Prompt 让模型扮演特定角色 | 需要专业领域知识时 |
| **Few-shot** | 给 2-3 个 input→output 示例 | 需要特定格式输出时 |
| **CoT（链式思考）** | 让模型"一步步思考" | 数学、逻辑推理问题 |
| **结构化输出** | 要求模型返回 JSON/特定格式 | 需要程序化使用结果时 |

## 关键实践

- **System Prompt 对比实验**：有无角色设定，回答质量差异明显
- **Temperature 对比**：0 适合代码/事实，1 适合创意写作
- **结构化输出 = Prompt + Zod Schema**：先定义格式，再要求模型遵守

## 关键代码模式

```text
# 角色设定示例
System: 你是一位资深前端架构师，擅长 React 性能优化
User: 如何解决大型列表渲染卡顿？

# Few-shot 示例
User: 
  输入：我喜欢这家餐厅 → 正面
  输入：服务态度很差 → 负面
  输入：味道还可以 → 
Assistant: 中性

# CoT 示例
User: 请一步步思考：一个水池有2个进水管...
```

## 常见误区

❌ Prompt 写得越长越好  
✅ 简洁明确 > 冗长模糊，关键信息前置

❌ 不给示例就期望模型按格式输出  
✅ Few-shot 比纯描述格式更有效

## 一句话总结

> Prompt Engineering 的本质是"用模型听得懂的语言描述你的需求"。

## 关联知识点

- **前置**：[Day 1（LLM 基础概念）](Day01-LLM基础概念.md)
- **后置**：[Day 3（Vercel AI SDK 入门）](../../阶段二-LLM_API集成开发/Day03-Vercel_AI_SDK入门.md)
