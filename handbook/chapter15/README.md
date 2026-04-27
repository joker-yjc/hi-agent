# 第 15 章：MCP 协议深入理解

> 本章目标：理解 MCP 协议的设计目标、核心架构、传输方式，以及它和 Tool Calling、传统 API 的本质区别。
> 对应学习计划：Day 20

---

## 概念速览

### 问题的起源

每个 AI 应用都需要连接外部工具：Claude Code 要读文件系统，Cursor 要访问 GitHub，在线 Chat 要查数据库。

传统做法：每个应用自己写 HTTP 调用、处理认证、解析响应。同样的"读文件"操作，Claude Code 写一遍，Cursor 写一遍，Mastra 再写一遍——重复造轮子。

### MCP 的解法

**Model Context Protocol = AI 应用的"USB-C 接口"**

定义统一的协议标准。任何人实现一个符合 MCP 规范的 Server，所有支持 MCP 的 AI 应用（Host）就能直接使用。

### 核心架构三层

```
┌────────────────────────────────────────────────────────┐
│  MCP Host                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ MCP Client A  │  │ MCP Client B  │  │ MCP Client C  │  │
│  │ (GitHub)      │  │ (FileSystem)  │  │ (Database)    │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                 │           │
│     stdio             stdio             stdio           │
│         │                 │                 │           │
│  ┌──────┴───────┐  ┌──────┴───────┐  ┌──────┴───────┐  │
│  │ GitHub       │  │ FileSystem   │  │ Database     │  │
│  │ MCP Server   │  │ MCP Server   │  │ MCP Server   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└────────────────────────────────────────────────────────┘
```

| 角色 | 职责 | 谁实现 |
|------|------|--------|
| **Host** | AI 应用本体（聊天界面、IDE、Agent 运行时） | 应用开发者 |
| **Client** | 对接某个具体 Server 的连接器，管理连接生命周期 | Host 内置 / SDK |
| **Server** | 独立的程序，提供具体的工具和数据访问能力 | 工具作者 |

✅ **关键认知**：Host 和 Server 之间通过**标准化 JSON-RPC 消息**通信，不关心对方的实现语言。Server 用 TypeScript 写，Python 的 Host 也能用。

### 三种核心能力

| 能力 | 作用 | 示例 |
|------|------|------|
| **Tools** | 可被 LLM 调用的函数 | `search_github_repos`、`read_file` |
| **Resources** | 暴露数据给 AI 读取（类似 GET 请求） | `file://documents/readme.md`、`database://users` |
| **Prompts** | 预定义的 Prompt 模板 | 代码审查模板、文档生成模板 |

⚠️ **容易混淆**：Tools 是"AI 主动调用的操作"，Resources 是"AI 查询的数据"。打个比方——Tool 是厨房里厨师用的锅铲（执行动作），Resource 是厨房台面上的食材（静态资源）。

### 三种传输方式

| 方式 | 连接模型 | 适用场景 |
|------|---------|---------|
| **stdio** | 标准输入/输出，进程间通信 | 本地命令行工具（最常见） |
| **SSE** | HTTP + Server-Sent Events | 远程 HTTP 服务 |
| **Streamable HTTP** | 双向 HTTP 流 | 需要双向实时通信的远程服务 |

✅ **学习阶段**：专注于 stdio 模式——不需要启动 HTTP 服务器，最简实现只需一个独立的可执行脚本。

---

## 技术选型

### 什么时候该做成 MCP Server

| 场景 | 推荐方案 |
|------|---------|
| 工具只在一个应用里用 | 应用内 `tool()` 定义即可 |
| 工具想在多个 AI 应用里复用 | 做成 MCP Server |
| 想把工具分享给社区 | 做成 MCP Server + 发布 npm |
| 需要动态发现工具列表 | MCP 的强项（Tool Calling 是静态的） |

### MCP vs Tool Calling vs REST API 全面对比

```
┌──────────────┬─────────────────┬──────────────────┬──────────────────┐
│    维度      │   Tool Calling  │      MCP         │    REST API      │
├──────────────┼─────────────────┼──────────────────┼──────────────────┤
│ 定义位置     │ 应用代码中硬编码 │ 独立进程/服务    │ HTTP 端点        │
│ 发现能力     │ 编译期固定      │ 运行时自动发现   │ 无标准发现机制   │
│ 协议标准     │ 各 SDK 自定格式 │ 统一 JSON-RPC    │ OpenAPI/Swagger  │
│ 上下文共享   │ 无              │ Host 统一管理    │ 无（无状态）     │
│ 认证方式     │ 应用自行处理    │ OAuth/API Key    │ 各 API 不同      │
│ 实时通信     │ 不支持          │ 支持             │ 轮询/WebSocket  │
│ 状态管理     │ 无              │ 有限             │ 无状态           │
│ 适用场景     │ 单应用内部工具  │ 跨应用共享工具   │ 第三方服务集成   │
│ 配置复杂度   │ 低（写代码）    │ 中（JSON 配置）  │ 中（写调用代码） │
│ 前端友好度   │ 高（全部 TS）   │ 中（了解协议）   │ 低（需处理 HTTP）│
└──────────────┴─────────────────┴──────────────────┴──────────────────┘
```

**层级关系**（从抽象到具体）：
```
Skill（最高抽象：任务级别）
  ├── 调用 MCP Server 的工具
  ├── 调用 Tool Calling 工具
  └── 调用 REST API

MCP（中间层：标准化工具协议）
  └── 底层：stdio / SSE / HTTP 传输

Tool Calling（底层：SDK 内置机制）
  └── 直接 execute 或通过 MCP Client 代理到 MCP Server
```

---

## 代码骨架

### MCP 消息格式（JSON-RPC 2.0）

所有 MCP 通信使用标准 JSON-RPC 2.0 格式：

```json
// Host → Server：请求调用工具
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "get_weather",
    "arguments": { "city": "北京" }
  }
}

// Server → Host：返回结果
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      { "type": "text", "text": "北京今天晴，25°C" }
    ]
  }
}
```

### 能力发现流程（初始化阶段的协议交换）

```
Host 连接到 Server 后，自动进行能力发现：

1. Host 发送: { method: "initialize" }
2. Server 返回: { capabilities: { tools: {}, resources: {} } }
3. Host 发送: { method: "tools/list" }
4. Server 返回: [
     { name: "get_weather", description: "获取城市天气", inputSchema: {...} },
     { name: "search_repos", description: "搜索 GitHub 仓库", inputSchema: {...} }
   ]
5. Host 发送: { method: "resources/list" }
6. Server 返回: [
     { uri: "file://docs/readme.md", name: "README", mimeType: "text/markdown" }
   ]
```

✅ **关键认知**：AI 不需要提前知道 Server 有什么工具——连接后自动发现，这就是 MCP 相比 Tool Calling 的核心优势。

---

## 实战建议（Day 20 任务指南）

1. **通读 MCP 官方文档的 Introduction 和 Core Architecture**（30 分钟）
   - 必读章节：Introduction、Core Architecture、Transports
   - 理解三层架构的职责划分
   - 截图/笔记记录关键概念

2. **浏览 MCP Servers 仓库中的 5 个实现**（20 分钟）
   - `@modelcontextprotocol/server-filesystem`：文件系统操作（适合理解 Resource 模式）
   - `@modelcontextprotocol/server-github`：GitHub API 封装（适合理解多 Tool 设计）
   - `@modelcontextprotocol/server-memory`：知识图谱记忆（适合理解复杂数据模型）
   - `@modelcontextprotocol/server-postgres`：数据库查询（适合理解工具参数设计）
   - `@modelcontextprotocol/server-brave-search`：网页搜索（适合理解外部 API 对接）
   - 重点观察：每个 Server 注册了哪些 Tools、Resource 怎么暴露数据

3. **在你的 IDE 或 Claude Desktop 中配置一个 MCP Server**（15 分钟）
   - 配置 `server-filesystem`（让 AI 直接读文件）
   ```json
   {
     "mcpServers": {
       "filesystem": {
         "command": "npx",
         "args": [
           "-y",
           "@modelcontextprotocol/server-filesystem",
           "/path/to/allowed/directory"
         ]
       }
     }
   }
   ```
   - 测试：让 AI "列出当前目录下所有 TypeScript 文件"——确认 MCP 在正常工作

4. **整理 MCP vs Tool Calling vs API 对比笔记**（10 分钟）
   - 至少写出 5 个不同维度的对比
   - 用自己的话描述每种方案的最佳使用场景

---

## 踩坑记录

✅ **坑 1：MCP Server 的 stdio 模式不能用 `console.log()` 调试**

stdio 的 stdout 是协议通道，任何非 JSON-RPC 输出都会导致 Host 解析失败。
```typescript
// ❌ 错误：stdout 被污染
console.log('正在加载数据...')

// ✅ 正确：调试信息输出到 stderr
console.error('正在加载数据...')
```
→ Host 会收到 `"正在加载数据..."` 然后尝试 JSON.parse，直接崩溃。

✅ **坑 2：MCP TypeScript SDK 版本变化大**
2024-2025 年间 SDK API 多次变更。旧教程中的 `server.setRequestHandler()` 在新版中变成了 `server.tool()` 注册方式。
→ **怎么绕**：以 `@modelcontextprotocol/sdk` npm 包的最新文档为准，看 TypeScript 类型定义比看教程更可靠。

✅ **坑 3：工具返回结果太大，直接塞满上下文窗口**
一个 MCP Server 返回了 5000 字的完整文件内容，中间还夹杂着零散的换行符，结果直接占满了 Agent 的上下文。
→ **怎么绕**：
- Server 端的 Tool 加 `maxLength` 参数限制返回长度
- Host 端限制每次检索/读取的资源数量
- 对于信息密集型接口，先返回摘要而非原文，AI 可按需再次查询

---

## 延伸阅读

| 资料 | 推荐理由 |
|------|---------|
| [MCP 官方文档](https://modelcontextprotocol.io/introduction) | 📖 协议完整文档，包括架构和规范 |
| [MCP 规范](https://spec.modelcontextprotocol.io) | 📖 技术规范细节 |
| [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) | 📖 SDK 完整文档和示例代码 |
| [MCP Servers 仓库](https://github.com/modelcontextprotocol/servers) | 📖 30+ 官方和社区 Server 实现参考 |
| [Claude Desktop MCP 配置指南](https://modelcontextprotocol.io/quickstart/user) | 📖 在实际 AI 应用中配置 MCP Server |

---

| [← 上一章：Agent 框架对比与 Skill 设计](../chapter14/README.md) | [下一章：MCP Server 开发实战 →](../chapter16/README.md) |
