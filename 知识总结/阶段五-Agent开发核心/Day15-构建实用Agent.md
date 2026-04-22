# Day 15 知识点总结：构建实用 Agent

> 阶段：阶段五 - Agent 开发核心（含记忆系统）

---

## 核心概念

- **实用工具**：网络搜索、网页抓取、数据查询
- **错误处理**：工具调用失败时的降级策略
- **多步推理**：`maxSteps` 让 Agent 自主完成复杂任务链

## 工具设计要点

| 工具 | 功能 | 注意 |
|------|------|------|
| `web_search` | 搜索 API（Tavily/SerpAPI） | 要有 mock fallback |
| `fetch_page` | 获取网页内容 | 必须加超时控制 |
| `query_data` | 查询本地 JSON | 支持数值范围过滤 |
| `summarize` | 文本摘要 | 明确是抽取式还是生成式 |

## 关键优化

### 1. System Prompt 外置

```typescript
// 从文件加载，方便调整
const systemPrompt = readFileSync('./prompts/web-agent.md', 'utf-8');
```

### 2. 超时控制

```typescript
const controller = new AbortController();
setTimeout(() => controller.abort(), 10000);
const res = await fetch(url, { signal: controller.signal });
```

### 3. 降级策略

```typescript
// API 失败时返回友好提示
if (!res.ok) return { error: '搜索服务暂不可用，请稍后重试' };
```

## 实践要点

- Prompt 外置到 `prompts/` 目录，无需改代码即可调整
- 网络请求必须加超时，防止 Agent 卡死
- 工具返回结构化数据，方便 LLM 理解

## 常见误区

❌ 工具返回原始 HTML 给 LLM  
✅ 先提取/清洗文本，再返回给 LLM

## 一句话总结

> 实用 Agent = 好工具 + 好 Prompt + 容错设计。

## 关联知识点

- **前置**：[Day 14（Agent + Tool Calling）](Day14-Agent与ToolCalling基础.md)
- **后置**：[Day 16（Agent 记忆系统）](Day16-Agent记忆系统-短期记忆.md)
