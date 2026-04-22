import Markdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github-dark.css'
import styles from './index.module.css'

interface ChatMessageProps {
  children: string
  role: 'user' | 'assistant'
}

export default function ChatMessage({ children, role }: ChatMessageProps) {
  const isUser = role === 'user'

  return (
    <div className={`${styles.messageRow} ${isUser ? styles.userRow : styles.aiRow}`}>
      <div className={styles.roleLabel}>{isUser ? '你' : 'AI'}</div>
      <div className={`${styles.bubble} ${isUser ? styles.userBubble : styles.aiBubble}`}>
        {isUser ? (
          <p className={styles.userText}>{children}</p>
        ) : (
          <Markdown
            rehypePlugins={[rehypeHighlight]}
            components={{
              pre: ({ children }) => (
                <pre className={styles.codeBlock}>{children}</pre>
              ),
            }}
          >
            {children}
          </Markdown>
        )}
      </div>
    </div>
  )
}