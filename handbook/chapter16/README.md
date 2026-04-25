# 第 16 章：MCP Server 开发实战

> 本章目标：从零开发一个实用的 MCP Server，通过 MCP Inspector 调试，集成到 AI 应用中。
> 对应学习计划：Day 21-22

---

## 概念速览

### 从第 15 章到动手：开发流程全貌

```
初始化项目 → 安装 SDK → 定义 Tools → 注册 Resources →
→ 启动传输层 → Inspector 调试 → 客户端配置 → 实际使用
```

### 一个合格 MCP Server 的最低标准

- 至少 2 个 Tools（给 AI 提供选择余地）
- 每个 Tool 有清晰的 `description`（否则 AI 不知道该不该调用）
- 参数用 Zod Schema 严格定义（防止 AI 传错参数类型）
- 合理的错误处理（API 挂了要告诉 AI，不要静默失败）

---

## 技术选型

### 核心依赖

```bash
pnpm add @modelcontextprotocol/sdk zod
pnpm add -D typescript @types/node tsx
```

| 包 | 作用 |
|----|------|
| `@modelcontextprotocol/sdk` | MCP Server/Client 的核心实现 |
| `zod` | Tool 参数的 Schema 定义（和 AI SDK 的 `tool()` 同样用法） |
| `tsx` | 不需要编译，直接跑 TypeScript |

### 调试工具

| 工具 | 用途 | 启动方式 |
|------|------|---------|
| **MCP Inspector** | 图形化测试，逐工具验证 | `npx @modelcontextprotocol/inspector tsx src/index.ts` |
| **Claude Desktop** | 在真实 AI 应用中使用 | 修改 `claude_desktop_config.json` |
| **Qoder / VS Code** | 在 IDE 内使用 | 配置 `.qoder/mcp.json` |

---

## 代码骨架

### 1. MCP Server 最小骨架

思路：先创建 Server 实例 → 用 `server.tool()` 逐个注册工具 → 连接到传输层。

```typescript
// src/index.ts — 最小可运行的 Server
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

// 1. 创建 Server 实例
const server = new McpServer({
  name: 'my-first-server',
  version: '1.0.0',
})

// 2. 注册 Tool — 关键：description 决定了 AI 会不会调用
server.tool(
  'get_server_info',
  '获取当前 MCP Server 的基本信息，包括名称和版本号',
  {}, // 无参数时传空对象
  async () => ({
    name: 'my-first-server',
    version: '1.0.0',
    uptime: process.uptime(),
  })
)

// 3. 启动（stdio 模式 — 通过标准输入/输出通信）
const transport = new StdioServerTransport()
await server.connect(transport)

// ⚠️ 关键：永远不要用 console.log 输出调试信息
// stdout 是 MCP 协议通道，只能用 console.error
console.error('Server started successfully')
```

### 2. 实用示例：笔记管理 Server

思路：定义一个"虚拟笔记系统"，AI 可以通过 Tool 创建/搜索/列出笔记。

```typescript
// src/notes-server.ts — 带数据持久化的实际 Server
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { readFileSync, writeFileSync, existsSync } from 'fs'

// 数据层：JSON 文件持久化
interface Note {
  id: string
  title: string
  content: string
  createdAt: string
}

const NOTES_FILE = './notes.json'

function loadNotes(): Note[] {
  if (!existsSync(NOTES_FILE)) return []
  return JSON.parse(readFileSync(NOTES_FILE, 'utf-8'))
}

function saveNotes(notes: Note[]): void {
  writeFileSync(NOTES_FILE, JSON.stringify(notes, null, 2), 'utf-8')
}

// Server 主逻辑
const server = new McpServer({ name: 'notes-server', version: '1.0.0' })

// Tool 1：创建笔记 — 思路：接收标题+内容，生成 ID 和创建时间，持久化
server.tool(
  'create_note',
  '创建一条新笔记。参数：title(笔记标题), content(笔记内容)',
  {
    title: z.string().describe('笔记标题'),
    content: z.string().describe('笔记内容'),
  },
  async ({ title, content }) => {
    const notes = loadNotes()
    const note: Note = {
      id: Date.now().toString(),
      title,
      content,
      createdAt: new Date().toISOString(),
    }
    notes.push(note)
    saveNotes(notes)
    return {
      success: true,
      note: { id: note.id, title: note.title, createdAt: note.createdAt },
    }
  }
)

// Tool 2：搜索笔记 — 思路：按关键词模糊匹配标题和内容
server.tool(
  'search_notes',
  '按关键词搜索笔记，返回匹配的笔记列表。参数：keyword(搜索关键词)',
  { keyword: z.string().describe('搜索关键词') },
  async ({ keyword }) => {
    const notes = loadNotes()
    const results = notes.filter(
      n => n.title.includes(keyword) || n.content.includes(keyword)
    )
    return { count: results.length, notes: results }
  }
)

// Tool 3：列出所有笔记 — 思路：返回按创建时间倒序的笔记列表
server.tool(
  'list_notes',
  '列出所有笔记，按创建时间倒序排列',
  {},
  async () => {
    const notes = loadNotes()
    const sorted = notes.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    return { count: sorted.length, notes: sorted }
  }
)

// 启动
const transport = new StdioServerTransport()
await server.connect(transport)
console.error('Notes server running')
```

### 3. 客户端配置

思路：Server 写好后，在任何支持 MCP 的应用里通过 JSON 配置接入。

```json
{
  "mcpServers": {
    "notes": {
      "command": "npx",
      "args": ["tsx", "/path/to/notes-server/src/notes-server.ts"]
    }
  }
}
```

---

## 实战建议（Day 21-22 任务指南）

### Day 21：写你的第一个 MCP Server
1. **初始化项目 + 安装依赖**（5 分钟）
2. **写最小 Server**（15 分钟）— 照着上面的"最小骨架"直接抄，跑通一条链路
3. **扩展成笔记 Server**（20 分钟）— 加入 JSON 文件持久化，3 个 Tool
4. **用 MCP Inspector 测试**（10 分钟）：
   ```bash
   npx @modelcontextprotocol/inspector tsx src/notes-server.ts
   ```
   在 Inspector 的 UI 中逐个测试每个 Tool 的输入/输出

### Day 22：做一个实际有用的 Server
从以下方向中选一个，用你自己的方案重新设计：

| 方向 | 思路 | 核心挑战 |
|------|------|---------|
| **GitHub 工具** | 接 GitHub Search API，让 AI 搜索仓库/Issue | 认证 token 配置、API 速率限制 |
| **天气查询** | 接免费天气 API，让 AI 查天气做出行建议 | 数据格式化、城市名称标准化 |
| **数据库查询** | 接 SQLite，让 AI 用自然语言查询数据 | SQL 安全（防止注入）、结果展示 |
| **学习笔记** | 如果你已经做了向量记忆（第 13 章），把它包装成 MCP Server | 记忆的 add/search/list 接口设计 |

---

## 踩坑记录

✅ **坑 1：`console.log` 会破坏 stdio 协议**
MCP 的 stdio 传输使用 stdout 作为 JSON-RPC 消息通道。任何非 JSON 输出都会让 Host 解析失败。
→ **铁律**：Server 代码中**永远只用 `console.error` 调试**，`console.log` 完全不出现。

✅ **坑 2：`z.describe()` 不是装饰，是给 AI 看的**
Zod 的 `.describe()` 方法写在 Schema 里不会被 TypeScript 编译器利用，但 MCP SDK 会把它暴露给 AI。
```typescript
// ❌ 模糊：AI 不知道该填什么
keyword: z.string()

// ✅ 精确：AI 清楚这个参数怎么用
keyword: z.string().describe('搜索关键词，将匹配笔记的标题和内容')
```

✅ **坑 3：npm 包没有 TypeScript 类型时，需要自己声明**
某些 MCP 相关包的旧版本缺少 TypeScript 类型定义。构建时报 `Could not find declaration file`。
→ **怎么绕**：`pnpm add -D @types/xxx` 或创建 `src/types/xxx.d.ts` 声明文件。

---

## 练习

### 基础练习
1. 运行上面的"笔记管理 Server"，用 Inspector 测试 `create_note` 和 `search_notes`
2. 修改 `list_notes` 工具：增加一个 `limit` 参数，让 AI 可以控制返回笔记数量

### 进阶挑战
1. 给笔记 Server 增加第 4 个 Tool：`delete_note`（根据 ID 删除笔记）
2. 实现一个带错误处理的版本：如果 `notes.json` 格式损坏，返回友好错误而不是崩溃

### 思考题
1. 笔记 Server 的三个 Tool 中，哪些适合做 Resource 而不是 Tool？为什么？
2. 如果把这个 Server 部署到远程服务器，传输方式应该从 stdio 改成什么？需要考虑哪些额外问题？

---

## 延伸阅读

| 资料 | 推荐理由 |
|------|---------|
| [MCP Server 开发指南 (TypeScript)](https://modelcontextprotocol.io/docs/first-server/typescript) | 📖 官方一步步教程，对新手最友好 |
| [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector) | 📖 调试工具的完整使用说明 |
| [MCP TypeScript SDK 源码](https://github.com/modelcontextprotocol/typescript-sdk) | ✅ 看 `examples/` 目录下的完整项目 |
| [@modelcontextprotocol/server-filesystem 源码](https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem) | ✅ 真实的生产级 MCP Server 实现 |

---

| [← 上一章：MCP 协议深入理解](../chapter15/) | [下一章：综合项目实战与后续方向 →](../chapter17/) |
