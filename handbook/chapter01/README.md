# 第 1 章：理解大语言模型

> 本章目标：用前端开发者能理解的方式，搞懂 LLM 到底在做什么。
> 对应学习计划：Day 1

---

## 概念速览

### Token — 模型的"基本文字单位"

LLM 不是按"字"或"单词"读文本的，是按 **Token** 读。一个 Token 约等于：
- 英文：~0.75 个单词，或 ~4 个字符
- 中文：~1.5-2 个汉字

```
"前端开发"          → 3 个 Token（前/端/开发）
"Hello World"      → 2 个 Token（Hello/ World）
"antidisestablishmentarianism" → 5 个 Token（anti/dis/establish/ment/arianism）
```

✅ **关键认知**：LLM 的计费、上下文容量、性能都是按 Token 算的，不是按"字数"。

### Context Window — 模型的"短期记忆容量"

模型在一次对话中能"记住"的最大 Token 数量。超出窗口的内容会被遗忘。

| 模型 | Context Window | 对应约中文量 |
|------|---------------|------------|
| GPT-4o | 128K | ~20-25 万字 |
| Claude 3.5 | 200K | ~30-40 万字 |
| Qwen3-Max | 32K | ~5-6 万字 |
| DeepSeek-V3 | 64K | ~10-12 万字 |

⚠️ **容易混淆**：Context Window ≠ 模型输出长度。Window 是"记忆容量"，`maxTokens` 是"一次输出上限"。

### Temperature — 模型的"创造力参数"

控制模型输出的随机性和多样性（0-2 之间）：
- `0`：最保守，每次输出几乎一样（适合数学题、代码生成）
- `0.5`：平衡，推荐默认值
- `1`：更有创造性（适合写诗、创意生成）
- `>1`：接近随机乱说，一般别用

✅ **实战规律**：需要精确答案的场景（代码、数学）Temperature 设 0.0-0.3；创意类场景设 0.7-1.0。

### 消息角色 — 对话的三类角色

| 角色 | 作用 | 示例 |
|------|------|------|
| `system` | 设定模型行为规则，最高优先级 | "你是一名金融分析师，只回答金融相关问题" |
| `user` | 用户输入 | "帮我分析一下特斯拉最新的财报" |
| `assistant` | 模型的回复 | "特斯拉 Q2 财报显示..." |

✅ **关键认知**：`system` 消息不像 `user` 那样是对话内容，它是"给模型下达的全局指令"。

### 一句话总结

> LLM 不是"理解"文本，而是基于概率预测下一个 Token。Token 决定成本，Context Window 决定记忆容量，Temperature 决定创意程度。

---

## 技术选型

### 在线体验工具

学习阶段先用这些工具建立直观认知，不需要写代码：

| 工具 | 用途 | 链接 |
|------|------|------|
| LLM Visualization | 交互式理解 Transformer 原理 | https://bbycroft.net/llm |
| OpenAI Tokenizer | 看 Token 如何分词 | https://platform.openai.com/tokenizer |

### 模型 API 平台

| 平台 | 推荐理由 | 注册链接 |
|------|---------|---------|
| **DeepSeek** | ✅ 价格最低，适合学习 | https://platform.deepseek.com |
| **阿里云百炼** | ✅ 国内访问快，通义千问生态 | https://bailian.console.aliyun.com |
| OpenAI | 标杆模型，功能最全 | https://platform.openai.com |

---

## 代码骨架

学习阶段先不写代码，用手动实验建立认知：

```
实验 1：在 ChatGPT 中测试 Temperature
  Prompt："用一句话解释什么是闭包"
  Temperature = 0 → 每次回答几乎完全相同
  Temperature = 1 → 每次措辞不同但核心意思一致

实验 2：在 Tokenizer 中对比中英文
  输入中文："人工智能正在改变世界"  → ~8-10 个 Token
  输入英文："Artificial intelligence is changing the world" → ~7 个 Token
  观察：中文 Token 效率低于英文（单位信息需要更多 Token）
```

---

## 实战建议（Day 1 任务指南）

按顺序完成：

1. **先看 LLM Visualization**（15-20 分钟）
   - 重点看 Transformer 的 Input → Embedding → Attention → Output 流程
   - 不需要懂数学，知道"每步在做什么"即可

2. **在 Tokenizer 上做实验**（10 分钟）
   - 输入一段你熟悉的前端代码
   - 观察函数名、关键字、括号是怎么分的
   - 中英文对比着看

3. **调 Temperature 做对比**（10 分钟）
   - 同一个 Prompt 分别设 0 和 1
   - 用技术问题（"解释 React Hooks"）和创意问题（"写一个产品标语"）分别测试

4. **整理笔记**（10 分钟）
   - 用自己的话解释 Token、Context Window、Temperature
   - 这是建立长期记忆的关键步骤

---

## 踩坑记录

✅ **坑 1：中文比英文"贵"**
同样的语义，中文消耗的 Token 数约是英文的 1.5-2 倍。长对话场景下成本差异显著。
→ **怎么绕**：有双语能力且追求性价比时，System Prompt 用英文写，对话内容用中文。

✅ **坑 2：上下文窗口不等于"无限记忆"**
很多模型号称 128K Token 上下文的，但其实随着对话变长，模型对中间部分的"注意力"会衰减。重要信息尽量放在对话的开头或结尾。
→ **怎么绕**：关键上下文放 System Prompt 或最近两轮对话中。

---

## 练习

### 基础练习
1. 用自己的话解释 Token、Context Window、Temperature 三个概念（不超过 100 字/个）
2. 在 [OpenAI Tokenizer](https://platform.openai.com/tokenizer) 中输入一段你熟悉的前端代码，观察函数名、关键字、括号是怎么被切分成 Token 的
3. 用同一个 Prompt（如"解释什么是闭包"）分别设 Temperature = 0 和 Temperature = 1，各测 3 次，记录输出差异

### 进阶挑战
1. 准备一段 200 字的中文技术说明，在 Tokenizer 中记录 Token 数；然后用英文表达同样语义，对比 Token 数差异。计算中文"贵"了多少百分比
2. 设计一个测试：验证"模型对长对话中间内容的注意力会衰减"这个说法。提示：在长对话的中间某轮隐藏一个关键信息，最后问模型这个信息是什么

### 思考题
1. 如果一款 AI 产品的目标用户主要是中文使用者，"中文 Token 效率低"这个事实会对产品成本产生什么影响？有什么应对策略？
2. Temperature 为 0 时模型输出"最确定"，但为什么代码生成场景有时还是推荐 0.1-0.3 而不是绝对的 0？

---

## 延伸阅读

| 资料 | 推荐理由 |
|------|---------|
| [LLM Visualization](https://bbycroft.net/llm) | 📖 交互式，前端实现的，代码架构可参考 |
| [OpenAI Tokenizer](https://platform.openai.com/tokenizer) | 📖 官方的，准确可靠 |
| [OpenAI 模型文档](https://platform.openai.com/docs/models) | 📖 了解各模型参数和能力 |
| [Anthropic 模型文档](https://docs.anthropic.com/en/docs/about-claude/models) | 📖 Claude 系列模型概览 |

---

|  | [下一章：Prompt Engineering 实战 →](../chapter02/README.md) |
