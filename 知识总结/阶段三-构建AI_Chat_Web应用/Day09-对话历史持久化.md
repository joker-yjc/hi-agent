# Day 09 知识点总结：对话历史 + 最终完善

> 阶段：阶段三 - 构建 AI Chat Web 应用

---

## 核心概念

- **localStorage 持久化**：前端存储对话历史
- **多会话管理**：新建/切换/删除对话
- **错误处理**：API 失败时的友好提示

## 关键代码模式

```typescript
// 保存对话
localStorage.setItem('chat-history', JSON.stringify(conversations));

// 加载对话
const conversations = JSON.parse(localStorage.getItem('chat-history') || '[]');
```

## 功能清单

- [ ] 侧边栏显示历史对话列表
- [ ] 新建对话按钮
- [ ] 删除对话确认
- [ ] 清空当前对话
- [ ] 复制消息内容

## 数据结构设计

```typescript
interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}
```

## 实践要点

- localStorage 有 5MB 限制，大量消息时需要压缩或清理
- 对话标题可以用第一条用户消息自动生成
- 错误处理用 Ant Design 的 `message.error()` 或自定义 Toast

## 一句话总结

> localStorage + 状态管理 = 前端对话历史持久化。

## 关联知识点

- **前置**：[Day 8（多模型切换）](Day08-多模型切换与UI完善.md)
- **后置**：[Day 10（RAG + Embedding 基础）](../../阶段四-RAG检索增强生成/Day10-RAG与Embedding基础.md)
