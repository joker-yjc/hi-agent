# 第 5 章：消息渲染与交互体验

> 本章目标：让 AI 聊天界面从"能看"变成"好看"——Markdown 渲染、代码高亮、消息样式、交互优化。
> 对应学习计划：Day 7

---

## 概念速览

### AI 回复的特征

AI 模型的回复有几个特点，决定了前端的渲染方式：

1. **包含 Markdown 格式** — 标题、列表、粗体、代码块等
2. **经常包含代码** — 特别是技术问答场景
3. **答案越长，Markdown 结构越复杂** — 需要靠谱的渲染库
4. **形势变化较快** — 同样的回复内容在不同时间在模型输出格式上可能不同

✅ **关键认知**：AI 回复的 Markdown 不是人类手写的，不完全符合 GFM 规范。选渲染库时要先验证兼容性。

### 技术方案对比

| 方案 | 性能 | 代码高亮 | 包大小 | 适用场景 |
|------|------|---------|--------|---------|
| `react-markdown` + `rehype-highlight` | 中等 | 一般 | 小 | 简单场景 |
| `react-markdown` + `shiki` | 好 | 优秀 | 中等 | 代码密集型 |
| `markdown-to-jsx` | 好 | 无（需自行集成） | 很小 | 极简场景 |
| 自己解析 + 正则匹配 | 差 | 差 | 无 | 千万别 |

✅ **推荐**：`react-markdown` + `remark-gfm`（GFM 扩展支持表格/任务列表）+ `rehype-highlight`（代码高亮），package 体量小，覆盖 90% 场景。

### 一句话总结

> AI 回复天然是 Markdown，react-markdown + remark-gfm + rehype-highlight 是前端渲染的最小可行方案。暗色模式用 CSS 变量，不要用硬编码颜色。

---

## 技术选型

```bash
# Day 7 需要安装
pnpm add react-markdown remark-gfm rehype-highlight highlight.js
```

| 库 | 作用 |
|----|------|
| `react-markdown` | 将 Markdown 字符串渲染为 React 组件 |
| `remark-gfm` | GFM 扩展（GitHub Flavored Markdown），支持表格、删除线、任务列表 |
| `rehype-highlight` | 代码块语法高亮（基于 highlight.js） |
| `highlight.js` | 代码高亮引擎，需要引入 CSS 主题 |

---

## 代码骨架

### ChatMessage 组件（区分用户/AI 样式）

```tsx
// components/ChatMessage/index.tsx
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'

interface ChatMessageProps {
  role: 'user' | 'assistant'
  children: string
}

export default function ChatMessage({ role, children }: ChatMessageProps) {
  const isUser = role === 'user'
  return (
    <div className={isUser ? 'message-user' : 'message-ai'}>
      <div className="message-role">{isUser ? '你' : 'AI'}</div>
      <div className="message-content">
        {isUser ? (
          <p>{children}</p>
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
          >
            {children}
          </ReactMarkdown>
        )}
      </div>
    </div>
  )
}
```

### ChatInput 组件（Enter 发送 + Shift+Enter 换行）

```tsx
// components/ChatInput/index.tsx
'use client'
import { useState, KeyboardEvent } from 'react'

export default function ChatInput({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [value, setValue] = useState('')

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (value.trim()) {
        onSubmit(value.trim())
        setValue('')
      }
    }
  }

  return (
    <textarea
      value={value}
      onChange={e => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder="输入消息，Enter 发送，Shift+Enter 换行"
      rows={3}
    />
  )
}
```

### Thinking 组件（等待首个 Token 时的动画）

```tsx
// components/Thinking/index.tsx
export default function Thinking() {
  return (
    <div className="thinking-container">
      <span className="thinking-dot" />
      <span className="thinking-dot" />
      <span className="thinking-dot" />
    </div>
  )
}
```

CSS 关键帧：
```css
@keyframes thinking-bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}
.thinking-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--text-secondary);
  animation: thinking-bounce 1.4s infinite ease-in-out;
}
```

---

## 实战建议（Day 7 任务指南）

1. **拆组件**（15 分钟）
   - `ChatMessage` — 负责渲染单条消息
   - `ChatInput` — 负责输入交互
   - `Thinking` — 负责加载状态

2. **实现 Markdown 渲染**（15 分钟）
   - 安装依赖后直接上 `react-markdown` + `remark-gfm` + `rehype-highlight`
   - 测试：发一条消息让 AI 返回包含代码块的内容
   - 确认语法高亮生效（JavaSctipt/TypeScript/Python 三种语言分别测试）

3. **样式处理**（15 分钟）
   - 用户消息靠右，AI 消息靠左
   - 用 CSS 变量适配暗色/亮色模式：

   ```css
   :root {
     --bg-user: #e3f2fd;
     --bg-ai: transparent;
     --text-primary: #1a1a1a;
   }
   @media (prefers-color-scheme: dark) {
     :root {
       --bg-user: #1e3a5f;
       --bg-ai: transparent;
       --text-primary: #e0e0e0;
     }
   }
   ```

4. **添加状态指示**（5 分钟）
   - `status === 'submitted'` → 显示 Thinking 动画
   - `status === 'streaming'` → 不需要额外指示器（消息在逐字渲染）
   - `status === 'error'` → 显示错误信息 + 重试

---

## 踩坑记录

✅ **坑 1：硬编码颜色在暗色模式下会看不清**
`backgroundColor: "#F5F5F5"` 在暗色主题下变成白底黑字，完全不可读。
→ **怎么绕**：全部改用 CSS 变量 + `prefers-color-scheme: dark`。

✅ **坑 2：`contentEditable` div 不支持 `placeholder` 属性**
用 div 做输入框时，placeholder 不生效。
→ **怎么绕**：改用 `textarea`，或用 CSS 伪元素 `::before` + `:empty` 实现。

✅ **坑 3：`rehype-highlight` 需要单独引入 CSS 主题**
只安装包不会有高亮效果，必须在全局 CSS 中引入：
```css
@import 'highlight.js/styles/github-dark.css';
```

---

## 练习

### 基础练习
1. 安装 `react-markdown` + `remark-gfm` + `rehype-highlight`，让 AI 回复能正确渲染标题、列表、粗体
2. 引入 `highlight.js` CSS 主题（如 `github-dark.css`），确认代码块语法高亮生效（测试 JS/TS/Python 三种语言）
3. 用 CSS 变量实现用户消息和 AI 消息的不同背景色，并适配暗色模式

### 进阶挑战
1. 为代码块添加"复制"按钮：hover 时显示，点击后把代码内容写入剪贴板
2. 实现暗色/亮色模式自动切换（用 `prefers-color-scheme` 媒体查询）

### 思考题
1. 为什么 AI 生成的 Markdown 可能不符合 GFM 规范？这对渲染库的选择有什么影响？
2. `streaming` 状态下 Markdown 是逐字渲染的，这会带来什么问题？（提示：不完整的 Markdown 语法，如未闭合的代码块）

---

## 延伸阅读

| 资料 | 推荐理由 |
|------|---------|
| [react-markdown 文档](https://github.com/remarkjs/react-markdown) | 📖 Markdown 渲染组件的完整文档 |
| [rehype-highlight](https://github.com/rehypejs/rehype-highlight) | 📖 代码高亮插件的配置方式 |
| [CSS prefers-color-scheme](https://developer.mozilla.org/zh-CN/docs/Web/CSS/@media/prefers-color-scheme) | 📖 暗色/亮色模式适配 |
| 本仓库 `stage-3-chat-app/src/components/` | ✅ ChatMessage/ChatInput/Thinking 完整实现 |

---

| [← 上一章：搭建最小 Chat 应用](../chapter04/) | [下一章：多模型切换与对话历史 →](../chapter06/) |
