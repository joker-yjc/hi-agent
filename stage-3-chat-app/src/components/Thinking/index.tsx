import styles from './index.module.css'

export default function Thinking() {
  return (
    <div className={styles['chat-thinking']}>
      <span className={styles['thinking-dot']} />
      <span className={styles['thinking-dot']} />
      <span className={styles['thinking-dot']} />
      <span>正在思考</span>
    </div>
  )
}
