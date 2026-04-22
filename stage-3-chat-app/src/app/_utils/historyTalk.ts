import type { UIMessage } from "ai"

const STORAGE_KEY = "chat-history"

export interface ChatSession {
  id: string
  title: string
  messages: UIMessage[]
  createdAt: number
  updatedAt: number
}

/**
 * 获取所有历史对话会话
 */
export function getAllSessions(): ChatSession[] {
  if (typeof window === "undefined") return []
  const data = localStorage.getItem(STORAGE_KEY)
  if (!data) return []
  try {
    return JSON.parse(data)
  } catch {
    return []
  }
}

/**
 * 根据ID获取单个会话
 */
export function getSessionById(sessionId: string): ChatSession {
  const sessions = getAllSessions()
  return sessions.find((s) => s.id === sessionId) as ChatSession
}

/**
 * 创建新会话
 */
export function createSession(title: string = "新对话"): ChatSession {
  const session: ChatSession = {
    id: Date.now().toString(),
    title,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  const sessions = getAllSessions()
  sessions.unshift(session)
  saveSessions(sessions)
  return session
}

/**
 * 更新会话（添加消息或修改标题）
 */
export function updateSession(
  sessionId: string,
  updates: Partial<Omit<ChatSession, "id">>
): ChatSession | null {
  const sessions = getAllSessions()
  const index = sessions.findIndex((s) => s.id === sessionId)
  if (index === -1) return null

  sessions[index] = {
    ...sessions[index],
    ...updates,
    updatedAt: Date.now(),
  }
  saveSessions(sessions)
  return sessions[index]
}

/**
 * 删除会话
 */
export function deleteSession(sessionId: string): boolean {
  const sessions = getAllSessions()
  const filtered = sessions.filter((s) => s.id !== sessionId)
  if (filtered.length === sessions.length) return false
  saveSessions(filtered)
  return true
}

/**
 * 清空所有历史
 */
export function clearAllSessions(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(STORAGE_KEY)
}

/**
 * 更新会话标题（根据第一条消息自动生成）
 */
export function updateSessionTitle(sessionId: string, title: string): ChatSession | null {
  return updateSession(sessionId, { title })
}

/**
 * 获取最近更新的会话列表（按更新时间排序）
 */
export function getRecentSessions(limit: number = 10): ChatSession[] {
  const sessions = getAllSessions()
  return sessions
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit)
}

// 内部辅助函数：保存会话列表到 localStorage
function saveSessions(sessions: ChatSession[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
}