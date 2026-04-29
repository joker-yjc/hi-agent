# OpenCode 记忆系统架构分析

> 分析对象：`references/opencode`
> 核心结论：OpenCode 的“记忆系统”本质上是**会话历史存储 + 会话压缩摘要（compaction）**，而不是独立的长期记忆库或向量检索系统。
> 分析日期：2026-04-28

---

## 1. 一句话结论

如果用你现在学习 Agent 记忆系统的视角来看，OpenCode 采用的是一种很实用的 **Session Memory** 方案：

- 完整会话先落到本地 SQLite。
- 当上下文过长时，不做向量化召回，而是触发一次 **AI 压缩总结**。
- 压缩后的摘要继续以普通消息的形式写回会话。
- 后续推理时，再把“摘要 + 最近保留的原始 tail”重新注入模型上下文。

所以它更像：

`原始历史 -> 压缩摘要 -> 摘要替代旧历史 -> 继续对话`

而不是：

`原始历史 -> 抽取事实 -> 向量库存储 -> 检索召回`

---

## 2. 整体架构

OpenCode 这套记忆机制主要分成 5 个模块：

| 模块 | 作用 | 关键文件 |
|------|------|----------|
| 会话存储层 | 保存 session/message/part | `packages/opencode/src/session/session.sql.ts` |
| 会话服务层 | 提供会话、消息、part 的读写接口 | `packages/opencode/src/session/session.ts` |
| 压缩层 | 在上下文过长时生成摘要 | `packages/opencode/src/session/compaction.ts` |
| 上下文重建层 | 过滤已压缩历史并转换为模型输入 | `packages/opencode/src/session/message-v2.ts` |
| Prompt 主循环 | 每轮对话前读取压缩后的上下文 | `packages/opencode/src/session/prompt.ts` |

可以概括为：

```text
SQLite(session/message/part)
  -> SessionPrompt.loop()
  -> MessageV2.filterCompactedEffect()
  -> MessageV2.toModelMessagesEffect()
  -> 模型推理
  -> 若超长则 SessionCompaction.create/process()
  -> 生成新的 summary assistant message
  -> 下轮继续使用摘要后的上下文
```

---

## 3. 数据模型设计

### 3.1 Session / Message / Part 三层结构

OpenCode 没有单独设计 `memory` 表，而是把记忆能力附着在消息系统上。

核心表定义在：`references/opencode/packages/opencode/src/session/session.sql.ts`

主要表：

- `session`
  - 会话元信息
  - 包含 `summary_additions`、`summary_deletions`、`summary_files`、`summary_diffs`
- `message`
  - 每条消息一行
  - `data` 字段用 JSON 存消息元信息
- `part`
  - 每条消息可拆成多个 part
  - `data` 字段用 JSON 存具体内容

这意味着 OpenCode 的会话不是“单条 message = 一段文本”，而是：

```text
message(info)
  + part(text)
  + part(tool)
  + part(file)
  + part(step-start)
  + part(step-finish)
  + part(compaction)
```

这种设计的好处是：

- 可以把工具调用、文本、文件、推理、压缩标记统一存到一条时间线里。
- 压缩摘要不需要额外建表，直接复用现有消息系统。

### 3.2 CompactionPart 是记忆锚点

`references/opencode/packages/opencode/src/session/message-v2.ts`

其中定义了一个很关键的 part：

```ts
type: "compaction"
auto: boolean
overflow?: boolean
tail_start_id?: MessageID
```

它不是摘要内容本身，而是一个“压缩锚点”。

作用：

- 标记这条 user message 是一次压缩请求。
- 记录这次压缩是否自动触发。
- 用 `tail_start_id` 指示“从哪里开始保留最近原始上下文”。

这点很重要：

OpenCode 并不是简单地“把前文全删了换一段总结”，而是：

- 前面的旧历史折叠成摘要
- 最近几轮保留原文
- 用 `tail_start_id` 把这两段拼接起来

这是一个很典型的 **summary + tail** 设计。

---

## 4. 记忆提取机制：它不是 facts extraction，而是 conversation compaction

### 4.1 手动触发入口

路由：`references/opencode/packages/opencode/src/server/routes/instance/session.ts`

`POST /:sessionID/summarize`

实际调用链：

1. `SessionCompaction.create(...)`
2. `SessionPrompt.loop({ sessionID })`

这里的 `summarize` 本质上不是单独跑一个“摘要 API”，而是向当前会话里插入一条特殊的 compaction 消息，再走正常 prompt 循环。

### 4.2 自动触发入口

核心文件：

- `references/opencode/packages/opencode/src/session/processor.ts`
- `references/opencode/packages/opencode/src/session/prompt.ts`

自动触发逻辑大意：

- 模型调用后发现 token/context overflow
- 或主循环检测到当前会话接近上下文上限
- 创建 compaction user message
- 下一轮进入 `SessionCompaction.process()`

也就是说，OpenCode 的“记忆提取”并不是把事实抽取成结构化记忆，而是把**长会话压缩成可继续推理的摘要上下文**。

### 4.3 压缩 prompt 模板设计

`references/opencode/packages/opencode/src/session/compaction.ts`

里面有一个固定的 `SUMMARY_TEMPLATE`，要求模型输出：

- Goal
- Constraints & Preferences
- Progress
- Key Decisions
- Next Steps
- Critical Context
- Relevant Files

这说明 OpenCode 压缩的不是“随便总结一下”，而是显式保留对编程 Agent 最关键的上下文：

- 当前目标
- 用户偏好
- 已完成进度
- 决策原因
- 下一步动作
- 关键文件

从 Agent 设计角度看，这比普通聊天摘要更有价值，因为它保留了**任务状态**，不只是自然语言对话内容。

---

## 5. 记忆存储机制

### 5.1 摘要如何落库

`references/opencode/packages/opencode/src/session/compaction.ts`

在 `process()` 里，OpenCode 会创建一条 assistant message：

- `mode: "compaction"`
- `agent: "compaction"`
- `summary: true`

然后把模型生成的摘要文本作为普通 text part 写回消息流。

所以“压缩后的记忆”实际存储方式是：

- 一条 user compaction message：负责标记压缩动作
- 一条 assistant summary message：负责承载压缩后的记忆内容

而不是额外存到 `memory` 表。

### 5.2 数据库真正写入位置

虽然业务代码经常调用 `session.updateMessage()` / `session.updatePart()`，但真正写入 SQLite 的是 projector。

关键文件：`references/opencode/packages/opencode/src/session/projectors.ts`

它负责：

- `Session.Event.Created/Updated/Deleted` -> 写 `session`
- `MessageV2.Event.Updated` -> 写 `message`
- `MessageV2.Event.PartUpdated` -> 写 `part`

所以 OpenCode 存储层是一个：

`领域服务 -> SyncEvent -> Projector -> SQLite`

这比直接在业务代码里 insert/update 更清晰，也更容易扩展同步或事件回放。

### 5.3 还有一层老的 JSON 存储

`references/opencode/packages/opencode/src/session/summary.ts`

这里把 diff 信息写到了：

- `session.summary_*` 字段
- 以及 `Storage.write(["session_diff", sessionID], diffs)`

也就是说，OpenCode 现在主链路已是 SQLite，但仍保留一部分 JSON 文件存储兼容逻辑，主要用于 diff 汇总，不是核心“记忆库”。

---

## 6. 记忆召回机制

### 6.1 核心不是检索，而是过滤与折叠

真正的“召回”发生在：

- `references/opencode/packages/opencode/src/session/message-v2.ts`
- `filterCompacted()` / `filterCompactedEffect()`

它的逻辑是：

- 从历史消息流中识别已经完成的 compaction 对
- 如果碰到带 `compaction` part 的 user message，并且已匹配到对应 summary assistant message
- 就停止继续向前展开旧历史
- 只保留：
  - compaction 触发消息
  - compaction summary 消息
  - 最近保留的 tail 原始消息

这相当于把“旧历史”召回成一个更短的代理表示。

### 6.2 重新注入模型上下文

`references/opencode/packages/opencode/src/session/message-v2.ts`

`toModelMessagesEffect()` 在处理 compaction user message 时，会注入：

```text
What did we do so far?
```

然后把对应的 assistant summary message 作为回答一起送回模型。

于是模型看到的是：

1. 用户问：“我们之前做了什么？”
2. assistant 给出一段结构化摘要
3. 再接上最近几轮未压缩的原始上下文

这是 OpenCode 很巧妙的一点：

- 它没有单独实现“memory injection protocol”
- 而是把压缩记忆伪装成一组普通对话消息
- 这样所有 provider/model 都能复用现有消息接口

### 6.3 Prompt 主循环怎么接入

`references/opencode/packages/opencode/src/session/prompt.ts`

主循环会先做：

1. `MessageV2.filterCompactedEffect(sessionID)`
2. `MessageV2.toModelMessagesEffect(msgs, model)`

所以每次真正送给模型的上下文，已经是**压缩后的会话视图**，而不是数据库里保存的全部历史。

这就形成了完整闭环：

```text
完整历史 -> 触发 compaction -> 生成摘要 -> 过滤旧历史 -> 注入摘要+tail -> 继续推理
```

---

## 7. `summary.ts` 的定位

`references/opencode/packages/opencode/src/session/summary.ts`

这个文件名字容易误导。它主要负责的是：

- 根据 snapshot 计算文件 diff
- 更新 session 级别的 diff 统计
- 给某条 user message 记录 `summary.diffs`

所以它更接近：

- 会话改动摘要
- UI 展示摘要
- 文件级 diff 汇总

而不是主“记忆压缩”实现。

真正决定模型上下文如何被压缩和回注的是 `compaction.ts + message-v2.ts + prompt.ts`。

---

## 8. 它是不是长期记忆系统？

结论：**不是。**

至少从当前 OpenCode 源码看，没有发现下面这些典型长期记忆特征：

- 独立 `memory` / `fact` / `entity` 表
- embedding 生成主链路
- 向量库存储
- 基于相似度的 memory retrieval
- 用户画像/偏好事实长期抽取模块

它保留的是：

- 完整会话历史
- 经 AI 压缩后的会话摘要
- 最近原始上下文 tail

所以更准确的命名应该是：

**会话压缩记忆（Session Compaction Memory）**

而不是：

**长期语义记忆（Long-term Semantic Memory）**

---

## 9. 这种设计的优点

### 9.1 实现简单，工程上很稳

优点：

- 不需要额外引入 embedding/vector db
- 不需要维护复杂的记忆抽取质量
- 与现有消息模型天然兼容
- 对不同模型供应商适配成本低

### 9.2 保留任务状态，而不只是聊天摘要

它的摘要模板保留了：

- Goal
- Constraints
- Progress
- Next Steps
- Relevant Files

这对代码 Agent 比“总结对话”更重要，因为真实工作依赖任务状态延续。

### 9.3 对长上下文问题非常直接

很多 Agent 系统最后卡在：

- 对话太长
- 工具输出太长
- 文件内容太长

OpenCode 的处理方式非常直接：

- 截断工具输出
- 折叠旧上下文
- 保留最近 tail
- 自动续跑

这是非常实战导向的方案。

---

## 10. 这种设计的限制

### 10.1 不能做跨会话长期知识积累

它擅长：

- 当前 session 内延续上下文

但不擅长：

- 跨多个 session 复用用户偏好
- 跨项目积累事实知识
- 基于语义相似度找历史经验

### 10.2 摘要质量强依赖模型

因为压缩完全依赖 LLM 生成摘要，所以会有典型风险：

- 关键信息遗漏
- 决策理由被弱化
- 某些边界上下文丢失

虽然模板化能缓解，但本质上仍是“生成式压缩”，不是“结构化事实存储”。

### 10.3 检索能力弱

它没有“从海量历史中按语义检索最相关记忆”的能力。

因此当问题不是“延续当前任务”，而是“从很久以前的多个会话中找一段相关经验”时，这套机制就不够强。

---

## 11. 对你学习 Agent Memory 的价值

如果你正在研究“提取、存储、召回”三件事，OpenCode 非常适合学习的是：

### 11.1 如何做会话级记忆压缩

值得重点学习：

- `CompactionPart` 这种锚点设计
- `summary + tail` 的折中策略
- 如何把压缩结果伪装成普通消息重新注入模型

### 11.2 如何让记忆系统复用现有消息架构

OpenCode 没有新造一整套 memory runtime，而是把记忆能力嵌入：

- message
- part
- prompt loop
- projector

这个设计很节制，也很工程化。

### 11.3 它适合作为长期记忆系统的“前半段”

如果以后你自己做 Agent，可以把 OpenCode 的这套方案当成：

- **短期 / 会话记忆层**

再叠加：

- **长期 / 语义记忆层**

组合成两层架构：

```text
短期层：OpenCode 风格 session compaction
长期层：事实抽取 + embedding + vector retrieval
```

这会比单独只做其中一种更完整。

---

## 12. 可复用设计草图

如果你后面想在自己的 Agent 项目里复用 OpenCode 这套思路，可以把它抽象成下面这个最小设计。

### 12.1 目标

解决的问题不是“长期知识管理”，而是：

- 会话太长导致上下文溢出
- 工具输出太多导致模型无法继续工作
- 多轮编码任务需要保留目标、进度、关键文件与下一步

### 12.2 最小模块划分

```text
SessionStore
  - 保存完整消息历史

CompactionTrigger
  - 检测 token 超限或手动触发

CompactionEngine
  - 选择 head/tail
  - 生成结构化摘要
  - 写回 summary message

ContextAssembler
  - 过滤已压缩历史
  - 注入 summary + recent tail
  - 转成模型输入
```

### 12.3 推荐数据结构

```ts
type SessionMessage = {
  id: string
  role: "user" | "assistant"
  summary?: boolean
  parentID?: string
  parts: SessionPart[]
}

type SessionPart =
  | { type: "text"; text: string }
  | { type: "tool"; output: string }
  | {
      type: "compaction"
      auto: boolean
      overflow?: boolean
      tailStartId?: string
    }
```

关键点：

- 不单独建 `memory` 表也可以实现会话压缩记忆
- 用 `summary: true` 标记压缩结果
- 用 `compaction` part 标记压缩锚点
- 用 `tailStartId` 控制最近原文保留范围

### 12.4 推荐流程

```text
1. 保存完整消息
2. 每轮推理前估算上下文大小
3. 若超限：
   - 创建 compaction user message
   - 选择最近 N 轮 tail
   - 让 LLM 输出结构化摘要
   - 写回 assistant summary message
4. 后续组装上下文时：
   - 折叠旧历史
   - 注入摘要
   - 追加 recent tail
5. 继续正常推理
```

### 12.5 建议保留的摘要模板

这部分可以直接借鉴 OpenCode 的思路：

- Goal
- Constraints & Preferences
- Progress
- Key Decisions
- Next Steps
- Critical Context
- Relevant Files

如果你的场景是代码 Agent，这组字段比普通聊天摘要更实用。

### 12.6 适合接到你自己的两层记忆架构里

对你自己的学习项目，我会建议把它放在“短期记忆层”：

```text
短期层（参考 OpenCode）
- session history
- compaction summary
- summary + tail reinjection

长期层（参考 Mem0 / Mastra Semantic / Working Memory）
- facts / preferences extraction
- vector retrieval
- structured working memory
```

这样组合后：

- OpenCode 负责“当前任务别爆上下文”
- Mem0/Mastra 风格模块负责“跨会话积累长期知识”

---

## 13. 关键源码索引

### 记忆主链路

- `references/opencode/packages/opencode/src/session/compaction.ts`
- `references/opencode/packages/opencode/src/session/message-v2.ts`
- `references/opencode/packages/opencode/src/session/prompt.ts`

### 数据存储

- `references/opencode/packages/opencode/src/session/session.sql.ts`
- `references/opencode/packages/opencode/src/session/projectors.ts`
- `references/opencode/packages/opencode/src/storage/db.ts`

### 摘要与 diff

- `references/opencode/packages/opencode/src/session/summary.ts`

### API 入口

- `references/opencode/packages/opencode/src/server/routes/instance/session.ts`

---

## 14. 最终总结

OpenCode 的记忆系统并不追求“像 Mem0 一样做长期记忆平台”，它追求的是另一件事：

**让编码 Agent 在超长会话里还能继续稳定工作。**

它的核心设计思想是：

- 把历史完整保存
- 在必要时进行 AI 压缩
- 把摘要重新伪装成普通消息上下文
- 保留最近的原始 tail 以减少信息损失

所以从架构定位上，它是：

**工程型 Session Memory**

而不是：

**知识型 Long-term Memory**

如果你下一步要继续对比学习，我建议可以把它和你已经分析过的 `mem0` 放在一起看：

- OpenCode：偏会话压缩
- Mem0：偏长期事实记忆

两者合起来，刚好能构成一个完整 Agent 记忆系统的两半。
