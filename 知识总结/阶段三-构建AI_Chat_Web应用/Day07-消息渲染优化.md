# Day 07 知识点总结：消息渲染优化（Markdown + 代码高亮）

> 阶段：阶段三 - 构建 AI Chat Web 应用

---

## 核心概念

- **Markdown 渲染**：AI 回复通常是 Markdown 格式，需要解析
- **代码高亮**：代码块需要语法高亮提升可读性
- **组件拆分**：ChatMessage、ChatInput 独立组件

## 技术选型

| 方案 | 库 | 特点 |
|------|-----|------|
| Markdown | `react-markdown` + `remark-gfm` | 支持 GitHub 风格 Markdown |
| 代码高亮 | `shiki` | 性能好，VS Code 同款 |
| 代码高亮 | `rehype-highlight` | 简单轻量 |

## 安装依赖

```bash
pnpm add react-markdown remark-gfm rehype-highlight highlight.js
# 或使用 shiki 方案：pnpm add react-markdown shiki
```

## 关键实践

- `react-markdown` 用 `components` prop 自定义渲染
- 用户消息和 AI 消息用不同样式（颜色/位置区分）
- ChatInput 支持：Enter 发送、Shift+Enter 换行

## 组件设计

```
ChatMessage
├── 用户消息：右对齐，蓝色背景
└── AI 消息：左对齐，Markdown 渲染 + 代码高亮

ChatInput
├── textarea（支持多行）
├── 发送按钮
└── 加载状态指示器
```

## 一句话总结

> AI 回复是 Markdown，前端需要"翻译"成漂亮的 UI。

## 关联知识点

- **前置**：[Day 6（项目搭建 + 基础聊天 UI）](Day06-项目搭建与基础聊天UI.md)
- **后置**：[Day 8（多模型切换）](Day08-多模型切换与UI完善.md)
