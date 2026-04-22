# Day 16 知识点总结：Agent 记忆系统 — 短期记忆

> 阶段：阶段五 - Agent 开发核心（含记忆系统）

---

## 核心概念

- **上下文（Context）**：单次对话的临时信息，LLM 自动处理
- **记忆（Memory）**：跨对话的持久信息，开发者主动设计
- **短期记忆**：Buffer / Window / Summary 三种模式

## 上下文 vs 记忆

| 维度 | 上下文 | 记忆 |
|------|--------|------|
| 生命周期 | 单次会话 | 跨会话 |
| 管理方式 | LLM 自动 | 开发者设计 |
| 存储位置 | API 参数 | 外部存储 |
| 容量限制 | Context Window | 可扩展 |

## 三种短期记忆对比

| 模式 | 策略 | Token 消耗 | 信息保留 |
|------|------|-----------|---------|
| **Buffer** | 完整历史 | 高 | 完整 |
| **Window** | 最近 K 轮 | 中 | 近期完整 |
| **Summary** | 摘要 + 最近轮 | 低 | 关键点 + 近期 |

## 双重设计（现代 Agent 通用模式）

```
fullHistory      → 完整历史（用于 UI 展示、用户查看）
     ↓
Memory Manager   → 压缩/过滤/摘要
     ↓
messagesForLLM   → 传给模型的消息（节省 Token）
```

## 关键代码模式（Summary Memory）

```typescript
class SummaryMemoryManager {
  private fullHistory: CoreMessage[] = [];      // 完整历史
  private summary = '';                          // 摘要
  
  async addUserMessage(content: string) {
    this.fullHistory.push({ role: 'user', content });
    
    // 超过阈值时生成摘要
    if (this.fullHistory.length / 2 > SUMMARY_THRESHOLD) {
      this.summary = await this.generateSummary();
    }
    
    return this.buildMessagesForLLM();
  }
  
  private buildMessagesForLLM(): CoreMessage[] {
    return [
      { role: 'system', content: `【历史摘要】${this.summary}` },
      ...this.fullHistory.slice(-KEEP_RECENT_ROUNDS * 2),
    ];
  }
}
```

## 主流 Agent 记忆实现

| Agent | 记忆类型 | 实现 |
|-------|---------|------|
| Claude Code | 静态规则 | CLAUDE.md + MCP Memory Server |
| OpenCode | 动态记忆 | SQLite + 向量检索 |
| mem0 | 混合记忆 | 向量 + 图混合架构 |

## 实践要点

- **Buffer**：适合 5-10 轮短对话
- **Window**：K=5 是常用平衡点
- **Summary**：需要两次 LLM 调用（生成摘要 + 继续对话）
- **双重设计**：fullHistory 给用户看，messagesForLLM 给模型用

## 常见误区

❌ 认为"对话历史 = 记忆"  
✅ 对话历史是上下文，记忆是经过筛选/压缩后的持久信息

## 一句话总结

> Agent 的记忆不是"记住所有对话"，而是"知道该记住什么、该忘掉什么"。

## 关联知识点

- **前置**：[Day 15（构建实用 Agent）](Day15-构建实用Agent.md)
- **后置**：Day 17（长期记忆 - 向量存储） ⏳ 待更新
