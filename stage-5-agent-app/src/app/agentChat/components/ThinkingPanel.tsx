/**
 * ThinkingPanel — Agent 思考过程可视化组件
 *
 * 展示 Agent 的工具调用链：
 * - 每个工具调用作为一个步骤卡片
 * - 显示工具名、参数、执行状态、返回结果
 * - 支持折叠/展开
 *
 * 适配 AI SDK v6 的 message.parts 中的 tool-invocation
 */

"use client"

import { useState } from "react"
import {
  Collapse,
  Tag,
  Space,
  Typography,
  Spin,
  Card,
  theme,
} from "antd"
import {
  ToolOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  FileSearchOutlined,
  GlobalOutlined,
  LinkOutlined,
} from "@ant-design/icons"

const { Text, Paragraph } = Typography
const { useToken } = theme

/** 工具图标映射 */
const toolIcons: Record<string, React.ReactNode> = {
  search_docs: <FileSearchOutlined />,
  web_search: <GlobalOutlined />,
  fetch_page: <LinkOutlined />,
}

/** 工具中文名映射 */
const toolNames: Record<string, string> = {
  search_docs: "知识库检索",
  web_search: "网页搜索",
  fetch_page: "获取网页",
}

/** 工具颜色映射 */
const toolColors: Record<string, string> = {
  search_docs: "blue",
  web_search: "green",
  fetch_page: "orange",
}

/** v6 UIMessage.parts 中的工具调用 part */
interface ToolPart {
  type: string
  /** 工具名（dynamic-tool 时从此取，tool-xxx 时从 type 截取） */
  toolName?: string
  toolCallId?: string
  /**
   * v6 状态：
   * - input-streaming / input-available → 执行中
   * - output-available → 完成
   * - output-error / output-denied → 失败/拒绝
   */
  state?: string
  /** v6: input 替代 args */
  input?: unknown
  /** v6: output 替代 result */
  output?: unknown
}

interface ThinkingPanelProps {
  /** 当前消息的所有工具调用 parts（v6） */
  toolParts: ToolPart[]
}

/**
 * 渲染单个工具调用步骤
 */
function ToolCallStep({ part }: { part: ToolPart }) {
  /** 从 type 截取工具名："tool-search_docs" → "search_docs"，"dynamic-tool" → 用 toolName */
  const toolName = part.type === "dynamic-tool"
    ? (part.toolName ?? part.type)
    : part.type.replace(/^tool-/, "")
  const args = part.input as Record<string, unknown> | undefined
  const result = part.output

  /** v6 状态映射：input-* → 执行中，output-available → 完成 */
  const isLoading = part.state?.startsWith("input") ?? false
  const isComplete = part.state === "output-available"

  const icon = toolIcons[toolName] ?? <ToolOutlined />
  const name = toolNames[toolName] ?? toolName
  const color = toolColors[toolName] ?? "default"

  return (
    <Card
      size="small"
      style={{
        marginBottom: 8,
        borderLeft: `3px solid ${isComplete ? "#52c41a" : "#1890ff"}`,
        background: isLoading ? "#f0f5ff" : "#f6ffed",
      }}
      styles={{ body: { padding: "8px 12px" } }}
    >
      <Space direction="vertical" size="small" style={{ width: "100%" }}>
        {/* 头部：工具名 + 状态 */}
        <Space>
          {icon}
          <Text strong>{name}</Text>
          <Tag color={color}>
            {toolName}
          </Tag>
          {isLoading && (
            <Tag icon={<LoadingOutlined />} color="processing">
              执行中
            </Tag>
          )}
          {isComplete && (
            <Tag icon={<CheckCircleOutlined />} color="success">
              完成
            </Tag>
          )}
        </Space>

        {/* 参数 */}
        {args && (
          <div
            style={{
              background: "#fafafa",
              padding: "6px 10px",
              borderRadius: 4,
              fontSize: 12,
            }}
          >
            <Text type="secondary" style={{ fontSize: 11 }}>
              参数:
            </Text>
            <pre
              style={{
                margin: "4px 0 0 0",
                fontSize: 12,
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                background: "transparent",
              }}
            >
              {JSON.stringify(args, null, 2)}
            </pre>
          </div>
        )}

        {/* 结果（执行完成后显示） */}
        {isComplete && result !== undefined && (
          <div
            style={{
              background: "#f6ffed",
              padding: "6px 10px",
              borderRadius: 4,
              fontSize: 12,
            }}
          >
            <Text type="secondary" style={{ fontSize: 11 }}>
              结果:
            </Text>
            <Paragraph
              ellipsis={{ rows: 3, expandable: true, symbol: "展开" }}
              style={{ marginBottom: 0, marginTop: 4, fontSize: 12 }}
            >
              {typeof result === "string" ? result : JSON.stringify(result)}
            </Paragraph>
          </div>
        )}
      </Space>
    </Card>
  )
}

/**
 * Agent 思考过程面板
 * 展示所有工具调用的折叠面板
 */
export default function ThinkingPanel({
  toolParts,
}: ThinkingPanelProps) {
  const { token } = useToken()
  // const [activeKey, setActiveKey] = useState<string | string[]>(["1"])

  if (!toolParts || toolParts.length === 0) {
    return null
  }

  const hasLoading = toolParts.some((t) => t.state?.startsWith("input"))
  const totalSteps = toolParts.length

  return (
    <Collapse
      // activeKey={activeKey}
      // onChange={(key) => setActiveKey(key as string[])}
      style={{
        marginBottom: 12,
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
      }}
      items={[
        {
          key: "1",
          label: (
            <Space>
              <ToolOutlined />
              <Text strong style={{ fontSize: 13 }}>
                🤔 思考过程
              </Text>
              {hasLoading && <Spin size="small" />}
              <Tag>{totalSteps} 步</Tag>
            </Space>
          ),
          children: (
            <div style={{ padding: "0 4px" }}>
              {toolParts.map((part, idx) => (
                <ToolCallStep key={idx} part={part} />
              ))}
            </div>
          ),
        },
      ]}
    />
  )
}
