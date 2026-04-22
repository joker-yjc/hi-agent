'use client';
import ChatInput from '@/components/ChatInput';
import ChatMessage from '@/components/ChatMessage';
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import PageHeader from './_components/PageHeader';
import Thinking from '@/components/Thinking';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getCurrentSessionId, setCurrentSessionId as setCurrentLocalSessionId } from './_utils';
import { createSession, getSessionById, updateSession } from './_utils/historyTalk';
import PageContext from './_context';

export default function Page() {
  const modelIdRef = useRef('qwen3-max')
  const [currentSessionId, _setCurrentSessionId] = useState(getCurrentSessionId)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: () => ({
        modelId: modelIdRef.current,
      }),
    }),
  })

  // streaming 过程中持续滚动到底部 + 持久化消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    if (currentSessionId && messages.length > 0) {
      updateSession(currentSessionId, { messages })
    }
  }, [messages, currentSessionId])

  const handleModelChange = (modelId: string) => {
    modelIdRef.current = modelId
  }

  const handleSubmit = (input: string) => {
    if (!currentSessionId) {
      const newSession = createSession()
      handleSessionIdChange(newSession.id)
    }
    sendMessage({ text: input })
  }

  // 切换会话：同时更新 sessionId 和 useChat 的 messages
  const handleSessionIdChange = useCallback((sessionId: string) => {
    _setCurrentSessionId(sessionId)
    setCurrentLocalSessionId(sessionId)

    if (sessionId) {
      const session = getSessionById(sessionId)
      setMessages(session?.messages ?? [])
    } else {
      setMessages([])
    }
  }, [setMessages])

  useEffect(() => {
    const sessionId = getCurrentSessionId()
    handleSessionIdChange(sessionId!)
  }, [])

  return (
    <PageContext.Provider value={{ sessionId: currentSessionId!, setCurrentSessionId: handleSessionIdChange }}>
      <div className="chat-container">
        <PageHeader modelChange={handleModelChange} />

        <div className="chat-messages">
          {messages.length === 0 && (
            <div className="chat-empty">发送一条消息开始对话</div>
          )}

          {messages.map(message => (
            <div key={message.id} className='message-item-container'>
              {message.parts.map((part, index) =>
                part.type === 'text' ? (
                  <ChatMessage
                    key={index}
                    role={message.role as 'user' | 'assistant'}
                  >
                    {part.text}
                  </ChatMessage>
                ) : null,
              )}
            </div>
          ))}

          {status === 'submitted' && (
            <Thinking />
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="chat-footer">
          <ChatInput
            onSubmit={handleSubmit}
          />
        </div>
      </div>
    </PageContext.Provider>
  )
}
