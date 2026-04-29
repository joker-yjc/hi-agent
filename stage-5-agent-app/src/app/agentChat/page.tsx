/**
 * Agent Chat 页面 — useChat 版本
 *
 * 使用 @ai-sdk/react v3 的 useChat 替代手动 fetch：
 * - 自动处理 SSE 流式输出
 * - 自动管理 messages 状态
 * - 支持 toolInvocations 可视化
 * - 通过 sendMessage options.body 传递 modelId
 *
 * AI SDK v6 useChat API 变化：
 * - 无 input/handleInputChange/handleSubmit，用 sendMessage({ text }) 替代
 * - 无 api/body 选项，transport 默认 POST /api/chat
 * - status: 'submitted' | 'streaming' | 'ready' | 'error'
 */

"use client"

import { useEffect, useRef, useState } from "react"
import { useChat } from "@ai-sdk/react"
import { Input, Button, Select, Space, Empty, theme, message } from "antd"
import { SendOutlined, RobotOutlined, ThunderboltOutlined } from "@ant-design/icons"
import MessageItem from "./components/MessageItem"

const { TextArea } = Input
const { useToken } = theme

/** 可选模型列表 */
const MODELS = [
  { label: "通义千问 3 Max", value: "qwen3-max" },
  { label: "Kimi K2.5", value: "kimi-k2.5" },
  { label: "MiniMax M2.5", value: "MiniMax-M2.5" },
]

export default function AgentChatPage() {
  const { token } = useToken()
  const [modelId, setModelId] = useState("qwen3-max")
  const [input, setInput] = useState("")
  const endRef = useRef<HTMLDivElement>(null)

  const {
    messages,
    sendMessage,
    status,
    stop,
  } = useChat({
    onError: (err) => {
      message.error("发送失败: " + err.message)
    },
  })

  /** status: 'submitted' | 'streaming' | 'ready' | 'error' */
  const isLoading = status === "submitted" || status === "streaming"

  /** 消息更新后自动滚动到底部 */
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  /** 发送消息 */
  const handleSend = () => {
    if (!input.trim() || isLoading) return
    sendMessage({ text: input.trim() }, { body: { modelId } })
    setInput("")
  }

  /** Enter 发送，Shift+Enter 换行 */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: token.colorBgLayout }}>
      {/* 顶部栏 */}
      <div style={{
        padding: "12px 24px", borderBottom: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgContainer, display: "flex", justifyContent: "space-between", alignItems: "center"
      }}>
        <Space>
          <RobotOutlined style={{ fontSize: 20, color: token.colorPrimary }} />
          <span style={{ fontSize: 16, fontWeight: 500 }}>🤖 Agent 助手</span>
          <ThunderboltOutlined style={{ color: token.colorWarning }} />
        </Space>
        <Space>
          <Select value={modelId} onChange={setModelId} options={MODELS} style={{ width: 160 }} size="small" />
        </Space>
      </div>

      {/* 消息区 */}
      <div style={{ flex: 1, overflow: "auto", padding: "16px 0" }}>
        {messages.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%" }}>
            <Empty description={
              <div style={{ textAlign: "center", color: token.colorTextSecondary }}>
                <p>发送消息开始对话</p>
                <p>支持知识库检索、网页搜索、多步推理</p>
              </div>
            } />
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <MessageItem key={msg.id} message={msg} />
            ))}
            <div ref={endRef} />
          </>
        )}
      </div>

      {/* 输入区 */}
      <div style={{ padding: "12px 24px 16px", borderTop: `1px solid ${token.colorBorderSecondary}`, background: token.colorBgContainer }}>
        <div style={{ display: "flex", gap: 12 }}>
          <TextArea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入问题，Enter 发送，Shift+Enter 换行..."
            autoSize={{ minRows: 1, maxRows: 6 }}
            disabled={isLoading}
            style={{ flex: 1, borderRadius: 8, padding: "10px 14px" }}
          />
          <Button
            type="primary"
            onClick={handleSend}
            loading={isLoading}
            disabled={!input.trim() || isLoading}
            icon={<SendOutlined />}
            style={{ height: 40, borderRadius: 8, padding: "0 20px" }}
          >发送</Button>
        </div>
      </div>
    </div>
  )
}
