# 第 17 章：综合项目实战与后续方向

> 本章目标：基于前 16 章的知识积累，设计并实现一个综合项目。同时标记后续学习方向，让学习路径可持续演进。
> 对应学习计划：Day 23-37

---

## 概念速览

### 你现在手里有什么

经过前 16 章的学习（对应 Day 1-22），你应该掌握了：

```
可用的能力                            →  对应的项目代码
────────────────────────────────────────────────────
Chat UI（流式对话）                   →  stage-3-chat-app/
Markdown 渲染 + 代码高亮             →  stage-3-chat-app/components/
多模型切换                           →  stage-3-chat-app/app/api/chat/
对话历史（localStorage 持久化）       →  stage-3-chat-app/_utils/
RAG 检索 + Embedding                 →  stage-4-rag/ + stage-4-rag-app/
Agent + Tool Calling                 →  stage-5-agent/tools/
三种记忆模式（Buffer/Window/Summary） →  stage-5-agent/
Provider 统一抽象                     →  packages/shared-utils/
MCP 协议理解 + Server 开发            →  第 15-16 章
```

### 综合项目的价值

综合项目不是"再做一个 demo"，而是**验证你是否真的能把这些能力组合起来解决实际问题**。

判断标准：你能不能在没有"照着教程抄"的心理依赖下，独立把 Chat UI + RAG + Agent + 记忆系统糅合成一个整体？

---

## 技术选型与架构设计

### 方向 A：AI 个人学习助手（融合度最高）

思路：把第 12-13 章的记忆系统 + 第 9 章的 RAG 管道 + 第 10-11 章的 Agent 全部塞进一个 Next.js 应用。

```
AI 个人学习助手

前端（Next.js + Ant Design）
├── Chat 界面（复用 stage-3 的 useChat 架构）
├── 文档管理（上传 → 分块 → Embedding → 向量存储）
├── 记忆管理（记忆列表 + 搜索 + 手动添加）
└── 规划文件（task_plan / progress / findings 编辑器）

后端 API
├── /api/chat        → Chat + RAG 检索混入上下文
├── /api/agent       → Agent Tool Calling（maxSteps）
├── /api/memory      → 记忆 CRUD + 向量搜索
├── /api/docs        → 文档上传 + 索引建立
└── /api/plan        → 规划文件的读写

数据层
├── JSON 文件 → 向量索引、记忆数据（学习阶段）
├── 或 SQLite → 结构化 + 向量二合一（进阶）
└── localStorage → 当前会话 ID（跨页面刷新）
```

**为什么推荐这个方向**：它要求你融合最多的已学知识——Chat + RAG + Agent + Memory 四者缺一不可，是真正的"综合能力测试"。

### 方向 B：AI 代码审查助手

思路：Agent 读取代码 → 分析 + 调用工具验证 → 输出现成的审查报告

```
流程：
  用户粘贴代码片段
    ↓
  Agent 分析（语言检测 → 规则匹配 → 调用 lint 工具）
    ↓
  生成报告：问题列表 + 严重等级 + 修复建议 + 参考代码
```

关键挑战：代码安全 — Agent 无权直接执行代码，只能静态分析。

### 方向 C：智能文档问答平台

思路：上传项目文档批量建立知识库 → 自然语言问答 → 自动标注引用来源

比阶段四的 RAG demo 更进一步：支持多文档、混合检索（关键词 + 向量）、增量更新索引。

---

## 代码骨架

### 综合项目的入口架构（page.tsx 骨架）

思路：聊天页面需要同时管理三个数据源——当前对话消息、相关文档检索结果、历史记忆。

```tsx
// page.tsx — 核心架构思路
export default function Page() {
  const modelRef = useRef('qwen3-max')

  // 核心：useChat 管理消息流
  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: () => ({
        modelId: modelRef.current,
        sessionId: currentSessionId, // ← 后端根据 sessionId 执行 RAG 检索
      }),
    }),
  })

  // 会话管理：切换时同步消息 + 清理状态
  const handleSessionSwitch = (id: string) => {
    const session = getSessionById(id)
    setMessages(session?.messages ?? [])  // 关键：强制同步 useChat 状态
    // 同时重置文档检索和记忆面板的状态...
  }

  // 消息持久化：每轮对话自动保存
  useEffect(() => {
    if (currentSessionId && messages.length > 0) {
      updateSession(currentSessionId, { messages })
    }
  }, [messages, currentSessionId])

  return (
    <Layout>
      <Sidebar>
        <HistoryDrawer onSwitch={handleSessionSwitch} />
        <MemoryPanel />   {/* ← 第 12 章的记忆系统 UI */}
      </Sidebar>

      <Main>
        <PageHeader>
          <ModelSelector onChange={id => modelRef.current = id} />
        </PageHeader>
        <MessageList messages={messages} />
        <ChatInput onSubmit={sendMessage} />
      </Main>

      <RightPanel>
        <DocReferences /> {/* ← 第 9 章的引用来源展示 */}
      </RightPanel>
    </Layout>
  )
}
```

### 后端路由：Chat API 融合 RAG 检索

思路：在 route.ts 中，收到用户消息后先做 3 件事 — 1) 向量检索文档、2) 搜索相关记忆、3) 拼入 System Prompt。

```typescript
// app/api/chat/route.ts — RAG 融合思路
export async function POST(req: NextRequest) {
  const { messages, modelId, sessionId } = await req.json()
  const lastMsg = messages[messages.length - 1] // 用户最新消息

  // 1. 向量检索知识库（第 8-9 章）
  const queryEmbedding = await createEmbedding(lastMsg.content)
  const topChunks = await searchChunks(queryEmbedding, topK=3)

  // 2. 搜索相关记忆（第 13 章）
  const relevantMemories = await searchMemories(lastMsg.content)

  // 3. 拼接上下文
  const context = [
    topChunks.length > 0 && `【知识库参考】\n${formatChunks(topChunks)}`,
    relevantMemories.length > 0 && `【历史记忆】\n${formatMemories(relevantMemories)}`,
  ].filter(Boolean).join('\n\n')

  // 4. 流式生成（第 3 章）
  const result = streamText({
    system: `基于以下参考信息回答问题。找不到相关信息时请明确告知。\n\n${context}`,
    model: qwen(modelId),
    messages: await convertToModelMessages(messages),
  })

  return result.toUIMessageStreamResponse()
}
```

---

## 实战建议（Day 23-27 任务指南）

### Day 23：规划 + 架构搭建（2-3 小时）
1. 确定项目方向（强烈推荐方向 A）
2. 在白板或 Markdown 里画架构图，把数据流走通
3. 初始化 Next.js 项目 + 装依赖（Ant Design + AI SDK + shared-utils）
4. 创建目录结构，先让一个 `pnpm dev` 能跑起来

### Day 24：核心 AI 功能（2-3 小时）
1. 搭数据库（SQLite 或 JSON 文件 — 学习阶段用 JSON 更简单）
2. 写 Chat API（支持流式响应）
3. 把第 8-9 章的 RAG 管道接入到 route.ts 的检索环节
4. 把第 12-13 章的记忆系统接入，每次对话自动检索相关记忆

### Day 25：前端界面（2-3 小时）
1. 聊天界面（复用 stage-3 的 ChatMessage + ChatInput + Thinking）
2. 文档管理页（Ant Design Table + Upload + 状态标签）
3. 记忆面板（记忆列表 + 搜索 + 手动添加）
4. 规划文件编辑器（Markdown 编辑器 or 简单 Textarea）

### Day 26：功能整合 + 打磨（2-3 小时）
1. 端到端测试：上传文档 → Chat 中问相关问题 → 验证 RAG 检索生效
2. 边缘情况处理：大文件限制、长对话上下文压缩、API 错误恢复
3. 交互优化：自动滚动、引用来源可折叠展开

### Day 27：部署 + 总结（2-3 小时）
1. 写 README 和项目文档
2. 部署到 Vercel：
   ```bash
   npm i -g vercel
   vercel deploy
   ```
3. 撰写学习总结：收获 + 难点 + 解决方案 + 后续方向

---

## 踩坑记录（综合项目专属）

✅ **坑 1：Chat + RAG + Memory 三者都在 System Prompt 里拼，容易超上下文窗口**
每种数据源取 Top-3 块，每块 500 字 → 三源加起来 4500 字，再加上对话历史很容易超限。
→ **怎么绕**：三源取 Top-1，每条摘要截断到 300 字以内；或分级注入（记忆放 System Prompt，RAG 结果放最后一条 user 消息前面）。

✅ **坑 2：文档更新后 RAG 索引没有自动刷新**
用户上传新文档，但旧的向量索引没更新，永远搜不到新内容。
→ **怎么绕**：上传时自动触发索引重建；或在搜索后根据文件名重新校验索引新鲜度。

✅ **坑 3：学习阶段不要一上来就上 SQLite + USearch**
看到 OpenCode 的设计觉得"我也要做一样的"，结果一天都在配环境，AI 逻辑一行没写。
→ **铁律**：学习阶段先用 JSON 文件存储，功能跑通后再说优化存储引擎。

---

## 练习

### 基础练习
1. 画出你的综合项目架构图（手绘或工具），标出数据流走向
2. 实现最小原型：Chat 界面 + RAG 检索（两个能力打通即可）

### 进阶挑战
1. 实现文档增量索引更新：上传新文档时，只对新文档做 Embedding，追加到现有索引
2. 实现规划文件自动总结：AI 对话结束后，自动提取 3 个要点写入 `progress.md`

### 思考题
1. 你的综合项目中，哪些组件是从之前的 stage 项目直接复用的？哪些需要重新设计？为什么？
2. 如果要把这个项目从一个"学习用的原型"升级到"可以给别人用的产品"，最少还需要加哪三个功能？

---

## 后续学习方向

以下主题在本手册中尚未充分覆盖，可作为你学完基础后的进阶方向：

| 方向 | 核心问题 | 推荐入门的资料 |
|------|---------|--------------|
| **多模态（图片理解）** | 如何让 AI "看懂"图片？（截图提问、UI 分析） | OpenAI Vision Guide、Claude Vision 文档 |
| **AI 安全** | 如何防止 Prompt 注入？如何过滤敏感输出？保护用户数据？ | OWASP AI Security Guide、Anthropic AI Safety Best Practices |
| **多 Agent 编排** | 什么时候单 Agent 不够？多个 Agent 怎么分工协作不冲突？ | LangGraph Multi-Agent 文档、Mastra Workflow |
| **成本控制** | 不同模型的费用差 10 倍，怎么选模型组合最省钱还不降质量？ | Token 计算器、LiteLLM Router 文档 |
| **LLM Wiki 知识管理** | Karpathy 提出的增量编译 Wiki，如何用它积累长期知识？ | llmwiki-compiler 仓库、Obsidian 官方文档 |

---

## 延伸阅读

| 资料 | 推荐理由 |
|------|---------|
| 本仓库所有 `stage-*/` 项目 | ✅ 可直接复用的全部代码产出 |
| 本手册第 1-16 章 | ✅ 每个知识点的代码骨架 + 踩坑记录 |
| [Vercel AI SDK RAG Chatbot Tutorial](https://sdk.vercel.ai/docs/guides/rag-chatbot) | 📖 官方的端到端 RAG 应用教程 |
| [Next.js 部署到 Vercel](https://nextjs.org/docs/app/building-your-application/deploying) | 📖 部署指南 |

---

| [← 上一章：MCP Server 开发实战](../chapter16/README.md) | [下一章：成本控制与 Token 优化 →](../chapter18/README.md) |
