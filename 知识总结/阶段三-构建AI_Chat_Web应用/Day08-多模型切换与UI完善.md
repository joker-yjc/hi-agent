# Day 08 知识点总结：多模型切换 + UI 完善

> 阶段：阶段三 - 构建 AI Chat Web 应用

---

## 核心概念

- **动态 Provider**：根据前端传入的模型参数，后端选择不同 Provider
- **前端传参**：模型选择通过请求 body 传给后端
- **shadcn/ui**：基于 Radix UI 的组件库，提升 UI 质量

## 关键代码模式

```typescript
// 后端动态选择模型
export async function POST(req: Request) {
  const { messages, model } = await req.json();
  
  const provider = model.startsWith('ollama') 
    ? ollama(model) 
    : openai(model);
  
  const result = await streamText({ model: provider, messages });
  return result.toDataStreamResponse();
}
```

## UI 优化清单

- [ ] 自动滚动到最新消息
- [ ] 空状态提示（欢迎界面）
- [ ] 响应式布局（移动端适配）
- [ ] 加载状态指示器

## shadcn/ui 初始化

```bash
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button input scroll-area select
```

## 实践要点

- ModelSelector 用 `<select>` 或 Dropdown 组件
- 切换模型后当前对话上下文应保留
- 不同模型的响应速度和风格差异明显

## 一句话总结

> 多模型切换 = 前端传参 + 后端动态选择 Provider。

## 关联知识点

- **前置**：[Day 7（消息渲染优化）](Day07-消息渲染优化.md)
- **后置**：[Day 9（对话历史持久化）](Day09-对话历史持久化.md)
