const currentSessionId = "current-session-id"

/**
 * @description: 创建聊天会话ID
 * @return {*}
 */
export function createChatSessionId() {
  return Date.now().toString()
}


/**
 * @description: 获取当前会话ID
 * @return {*}
 */
export function getCurrentSessionId() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(currentSessionId)
}


/**
 * @description: 设置当前会话ID
 * @param {string} sessionId
 * @return {*}
 */
export function setCurrentSessionId(sessionId: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(currentSessionId, sessionId)
}

