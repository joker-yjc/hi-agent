# Findings & Decisions

## Requirements
- 分析 `references/` 目录下 clone 的 OpenCode 源码
- 聚焦记忆系统架构设计
- 重点关注记忆提取、存储、召回机制
- 输出中文报告到 `docs/` 目录

## Research Findings
- 已确认项目根目录存在 `references/` 与 `docs/`
- 已确认 `docs/` 下已有同类分析文档，可复用其文档风格
- 已定位目标源码目录为 `references/opencode`
- OpenCode 的“记忆系统”核心不是真正的长期 memory/vector store，而是“会话历史 + compaction 压缩摘要”
- 主要核心文件包括：
  - `references/opencode/packages/opencode/src/session/compaction.ts`
  - `references/opencode/packages/opencode/src/session/message-v2.ts`
  - `references/opencode/packages/opencode/src/session/prompt.ts`
  - `references/opencode/packages/opencode/src/session/session.sql.ts`
  - `references/opencode/packages/opencode/src/session/summary.ts`
- `session.sql.ts` 证明主存储是 SQLite/Drizzle，核心表为 `session`、`message`、`part`
- `summary.ts` 主要负责 diff 汇总，不是主上下文压缩链路
- 真正的上下文压缩主链路在 `compaction.ts`，后续通过 `message-v2.ts` 中的压缩过滤与模型消息转换重新注入上下文

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| 报告以“整体架构/提取/存储/召回/优缺点”结构展开 | 与用户当前学习目标直接对应 |
| 将 OpenCode 的“记忆”界定为会话压缩记忆而非长期记忆 | 已有源码证据显示未发现独立长期记忆库或向量检索主链路 |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| `glob` 未直接匹配到 OpenCode 包路径 | 改为读取 `references/` 目录并逐层定位 |

## Resources
- `/Users/joke/Desktop/hi-agent/references/`
- `/Users/joke/Desktop/hi-agent/docs/mem0-architecture-analysis.md`
- `/Users/joke/Desktop/hi-agent/references/opencode/packages/opencode/src/session/compaction.ts`
- `/Users/joke/Desktop/hi-agent/references/opencode/packages/opencode/src/session/message-v2.ts`
- `/Users/joke/Desktop/hi-agent/references/opencode/packages/opencode/src/session/session.sql.ts`

## Visual/Browser Findings
- 本任务暂无浏览器/图片信息
