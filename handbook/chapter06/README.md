# 第 6 章：多模型切换与对话历史

> 本章目标：实现模型切换（前端选模型 → 后端动态路由）、对话历史持久化（localStorage + 多会话管理）。
> 对应学习计划：Day 8-9

---

## 概念速览

### 模型路由（Model Routing）

核心思想：前端告诉后端"用哪个模型"，后端根据参数选择不同的 Provider 实例：

```
前端 Select 选模型 → POST body { modelId: 'qwen3-max' } →
后端根据 modelId → qwen('qwen3-max') → 调用阿里云 API
```

### 对话历史（Session Management）

核心数据结构：

```
localStorage {
  "chat-history": [
    {
      id: "1712345678000",
      title: "React 性能优化讨论",
      messages: [ { id, role, parts: [{type:'text', text}] }, ... ],
      createdAt: 1712345678000,
      updatedAt: 1712345689000,
    }
  ]
}
```

✅ **关键认知**：消息格式要**统一为 `UIMessage` 类型**（来自 `ai` 包），这样 `useChat` 的 `messages` 和 localStorage 中存的数据是同一个类型，不用来回转换。

### 一句话总结

> `useRef` 避免闭包陷阱让 modelId 实时更新，`UIMessage` 类型统一让 localStorage 和 useChat 无缝衔接，`setMessages` 实现会话切换时的状态同步。

---

## 技术选型

| 组件 | 推荐 |
|------|------|
| 模型切换 UI | Ant Design `Select` |
| 历史侧边栏 | Ant Design `Drawer` + `List` |
| 重命名对话 | Ant Design `Modal` + `Input` |
| 删除确认 | Ant Design `Modal.confirm` |
| 自动滚动 | `useEffect` + `scrollIntoView` |

---

## 代码骨架

### 1. 前端把 modelId 传给后端

```typescript
// page.tsx
const modelIdRef = useRef('qwen3-max')

const { messages, sendMessage } = useChat({
  transport: new DefaultChatTransport({
    api: '/api/chat',
    body: () => ({
      modelId: modelIdRef.current, // 每次请求从 ref 取最新值
    }),
  }),
})

// useRef 而非 useState，避免闭包导致 modelId 不更新
const handleModelChange = (modelId: string) => {
  modelIdRef.current = modelId
}
```

### 2. 后端接收 modelId 并路由

```typescript
// route.ts
const llmMapping: Record<string, string> = {
  "qwen3-max": "qwen3-max",
  "kimi-k2.5": "kimi-k2.5",
  "MiniMax-M2.5": "MiniMax-M2.5",
}

export async function POST(req: NextRequest) {
  const { messages, modelId } = await req.json()
  const model = qwen(llmMapping[modelId] ?? llmMapping["qwen3-max"])
  const result = streamText({ model, messages: await convertToModelMessages(messages) })
  return result.toUIMessageStreamResponse()
}
```

### 3. 对话历史 CRUD（historyTalk.ts）

```typescript
// app/_utils/historyTalk.ts
import type { UIMessage } from 'ai'

export interface ChatSession {
  id: string
  title: string
  messages: UIMessage[]   // ⚠️ 统一用 UIMessage 类型
  createdAt: number
  updatedAt: number
}

export function getAllSessions(): ChatSession[] { /* localStorage 读取 */ }
export function createSession(title?: string): ChatSession { /* 创建 + 保存 */ }
export function updateSession(id: string, updates: Partial<ChatSession>): ChatSession | null
export function deleteSession(id: string): boolean
```

### 4. 会话切换 — 同步 useChat 状态

```typescript
// page.tsx — 核心：切换对话时更新 useChat 的 messages
const { messages, setMessages, sendMessage } = useChat({ ... })

const handleSessionIdChange = useCallback((sessionId: string) => {
  setCurrentLocalSessionId(sessionId)  // 持久化当前 ID
  if (sessionId) {
    const session = getSessionById(sessionId)
    setMessages(session?.messages ?? []) // 同步到 useChat
  } else {
    setMessages([]) // 新建对话
  }
}, [setMessages])
```

### 5. 自动滚动（持续流式更新时也能滚动）

```typescript
const messagesEndRef = useRef<HTMLDivElement>(null)

useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
}, [messages]) // 每条新消息/每次流式更新都触发
```

---

## 实战建议（Day 8-9 任务指南）

### Day 8：多模型切换
1. 先在 `PageHeader` 中添加 `<Select>` 组件
2. 准备好 3 个模型（qwen3-max + 另外两个）
3. 用 `useRef` 持有 modelId（不是 `useState`）
4. 后端写好 `llmMapping` 做路由
5. 测试：切换模型后发消息，确认调的是选中的模型

### Day 9：对话历史
1. 写 `historyTalk.ts` — ChatSession 的完整 CRUD
2. 在 `page.tsx` 中用 `setMessages` 处理会话切换
3. 用 `useEffect` 把 `messages` 实时同步回 localStorage
4. 创建 `HistoryDrawer` 组件：

```
HistoryDrawer
├── 新对话按钮（setCurrentSessionId('')）
├── 对话列表（按 updatedAt 排序）
│   └── 每条：点击切换 + Dropdown(重命名/删除)
├── 重命名 Modal
└── 删除确认 Modal
```

5. 通过 React Context 传递 `{ sessionId, setCurrentSessionId }`

---

## 踩坑记录

✅ **坑 1：用 `useState` 存 modelId 会导致闭包过期**

```typescript
// ❌ 错误：handleModelChange 更新 state 后，useChat 中的闭包还是旧值
const [modelId, setModelId] = useState('qwen3-max')
const { messages } = useChat({
  body: () => ({ modelId }), // 这个 modelId 不更新！
})

// ✅ 正确：用 useRef
const modelIdRef = useRef('qwen3-max')
const { messages } = useChat({
  body: () => ({ modelId: modelIdRef.current }), // 每次都是最新值
})
```

原因：`useChat` 中的 `transport` 在初始化时捕获闭包，state 更新不会重建 transport。

✅ **坑 2：切换会话时忘了同步 useChat 的 messages**
只更新 `currentSessionId` 状态，但 `useChat` 内部的 `messages` 还是旧会话的。
→ **怎么绕**：调用 `setMessages(session?.messages ?? [])` 强制覆盖。

✅ **坑 3：SSR 预渲染时 localStorage 不可用**
Next.js 构建时在服务端执行组件代码，`localStorage` 未定义。
→ **怎么绕**：所有 localStorage 读写函数加 `typeof window === 'undefined'` 保卫。

---

## 练习

### 基础练习
1. 实现模型选择器（Select），切换模型后发送消息，通过后端日志或响应确认调用了正确的模型
2. 实现 `ChatSession` 的完整 CRUD：创建新会话、读取列表、更新标题、删除会话
3. 实现会话切换：点击历史记录项，`useChat` 的 `messages` 同步更新为新会话的内容

### 进阶挑战
1. 给所有 localStorage 读写函数加上 SSR 安全守卫（`typeof window === 'undefined'`）
2. 实现自动滚动：每条新消息到达时自动滚到底部（用 `useEffect` + `scrollIntoView`）

### 思考题
1. 为什么用 `useRef` 而不是 `useState` 来存 modelId？如果坚持用 `useState`，有什么替代方案能让闭包拿到最新值？
2. 如果对话历史很多（100+ 会话），localStorage 的性能会成为瓶颈吗？你会怎么解决？

---

## 延伸阅读

| 资料 | 推荐理由 |
|------|---------|
| [Ant Design Select](https://ant.design/components/select-cn) | 📖 模型选择器组件 |
| [Ant Design Drawer](https://ant.design/components/drawer-cn) | 📖 历史侧边栏组件 |
| [React useRef vs useState](https://react.dev/reference/react/useRef) | 📖 理解闭包和 ref 的区别 |
| 本仓库 `stage-3-chat-app/` | ✅ 完整的 ChatSession CRUD + 多模型切换实现 |

---

| [← 上一章：消息渲染与交互体验](../chapter05/) | [下一章：Embedding 与向量基础 →](../chapter07/) |
