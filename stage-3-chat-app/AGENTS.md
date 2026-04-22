<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AGENTS.md - stage-3-chat-app 开发指南

## 📋 项目简介

这是 AI Learning Plan 的第三阶段项目 - AI Chat Web 应用，基于 Next.js 15 + Vercel AI SDK + Ant Design。

## 🛠️ 开发命令

```bash
pnpm dev          # 启动开发服务器 (http://localhost:3000)
pnpm build        # 构建生产版本
pnpm start        # 启动生产服务器
pnpm lint         # 运行 ESLint 检查
pnpm lint:fix     # 自动修复 ESLint 问题
```

## 📦 技术栈

- **框架**: Next.js 15 (App Router)
- **语言**: TypeScript
- **AI SDK**: Vercel AI SDK v6 (@ai-sdk/react, @ai-sdk/alibaba)
- **UI**: Ant Design 6.x, Tailwind CSS 4
- **状态管理**: React Context + localStorage

## 🎨 代码规范

### 1. TypeScript
- 必须使用 TypeScript，禁止使用 `any`
- 接口命名使用 PascalCase

### 2. 组件结构
```typescript
// 组件文件结构示例
import styles from './index.module.css';

interface ComponentNameProps {
  title: string;
  onClick?: () => void;
}

export default function ComponentName({ title, onClick }: ComponentNameProps) {
  return (
    <div className={styles.container}>
      {title}
    </div>
  );
}
```

### 3. 导入顺序
1. React/Next.js 相关
2. 第三方库 (antd, @ai-sdk/*)
3. 项目内部绝对导入 (@/...)
4. 相对导入
5. 类型导入 (import type)

### 4. AI SDK 使用
```typescript
// ✅ 正确：使用 v6 API
import { useChat } from '@ai-sdk/react';
import { streamText, convertToModelMessages } from 'ai';

// ❌ 错误：已废弃的 API
// generateEmbedding() → 使用 embed() 代替
```

### 5. 样式
- 使用 CSS Modules (`*.module.css`)
- 使用 Tailwind CSS 进行全局样式
- 暗色主题支持通过 CSS 变量实现

### 6. 错误处理
```typescript
// API Route 错误处理
try {
  const result = streamText({...});
  return result.toUIMessageStreamResponse();
} catch (error) {
  console.error('API Error:', error);
  return Response.json({ error: '服务错误' }, { status: 500 });
}
```

## 📁 目录结构

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   │   └── chat/
│   │       └── route.ts  # 聊天 API
│   ├── _components/       # 项目内部组件
│   ├── _context/          # React Context
│   ├── _utils/            # 工具函数
│   ├── page.tsx           # 主页面
│   └── layout.tsx         # 布局
├── components/             # 公共组件
│   ├── ChatInput/
│   ├── ChatMessage/
│   └── Thinking/
└── utils/                 # 工具函数
```

## ⚠️ 注意事项

1. **Next.js 15** 有 breaking changes，编写代码前请阅读文档
2. **环境变量**：使用 `.env` 存储 API Key，创建 `.env.example` 供参考
3. **API Key 安全**：绝对不要提交真实的 API Key 到版本控制

## 🔧 常用命令

| 用途 | 命令 |
|------|------|
| Lint | `pnpm lint` |
| 类型检查 | `npx tsc --noEmit` |
| 开发 | `pnpm dev` |

---

*此文件供 AI 编程代理使用*
