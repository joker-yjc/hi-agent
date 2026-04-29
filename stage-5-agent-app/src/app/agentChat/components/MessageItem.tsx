/**
 * MessageItem — 单条消息渲染
 *
 * 适配 AI SDK v6 UIMessage.parts 结构：
 * - 文本内容从 parts[type='text'] 提取，不再用 message.content
 * - 工具调用从 parts[type='tool-xxx'/'dynamic-tool'] 提取
 *
 * Markdown 样式由 github-markdown-css 统一管理，组件无需内联样式覆盖
 */

"use client"

import { Avatar, Space, theme } from "antd"
import { UserOutlined, RobotOutlined } from "@ant-design/icons"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeHighlight from "rehype-highlight"
import "highlight.js/styles/github-dark.css"
import "github-markdown-css/github-markdown-light.css"
import ThinkingPanel from "./ThinkingPanel"

const { useToken } = theme

/** v6 UIMessage.parts 中的工具调用类型 */
interface ToolPartLike {
  type: string
  toolName?: string
  toolCallId?: string
  state?: string
  input?: unknown
  output?: unknown
}

/** 判断 part 是否为工具调用 */
function isToolPart(part: any): part is ToolPartLike {
  return part.type?.startsWith("tool-") || part.type === "dynamic-tool"
}

export default function MessageItem({ message }: { message: any }) {
  const { token } = useToken()
  const isUser = message.role === "user"

  /** 从 parts 提取文本内容（v6 用 parts 替代 content） */
  const textContent = (message.parts ?? [])
    .filter((p: any) => p.type === "text")
    .map((p: any) => p.text)
    .join("")

  /** 从 parts 提取工具调用（v6 用 parts 替代 toolInvocations） */
  const toolParts = (message.parts ?? []).filter(isToolPart)

  const renderContent = () => {
    if (!textContent || textContent.trim() === "") {
      return null
    }

    return (
      <div
        className="markdown-body"
        style={{
          padding: "10px 14px",
          borderRadius: 12,
          background: isUser ? token.colorPrimary : token.colorBgElevated,
          color: isUser ? "#fff" : "inherit",
          maxWidth: "100%",
        }}
      >
        <Markdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
        >
          {textContent}
        </Markdown>
      </div>
    )
  }

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        marginBottom: 16,
        padding: "0 8px",
      }}
    >
      <Space
        align="start"
        style={{
          flexDirection: isUser ? "row-reverse" : "row",
          maxWidth: "85%",
        }}
      >
        <Avatar
          icon={isUser ? <UserOutlined /> : <RobotOutlined />}
          style={{
            background: isUser ? token.colorPrimary : token.colorInfo,
            flexShrink: 0,
          }}
        />
        <div style={{ maxWidth: "100%" }}>
          {!isUser && toolParts.length > 0 && (
            <ThinkingPanel toolParts={toolParts} />
          )}
          {renderContent()}
        </div>
      </Space>
    </div>
  )
}
