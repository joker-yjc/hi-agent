import { useRef, useState } from 'react'
import styles from './index.module.css'
import { Button, Input } from 'antd'

const { TextArea } = Input

interface ChatInputProps {
  onSubmit?: (val: string) => void
}

export default function ChatInput({ onSubmit }: ChatInputProps) {
  const [value, setValue] = useState<string | undefined>(undefined)

  const handleSubmit = () => {
    const content = value?.trim?.()
    if (!content) return
    onSubmit?.(content)
    setValue(undefined)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <>
      <TextArea
        value={value}
        onChange={(e) => setValue(e?.target?.value)}
        onKeyDown={handleKeyDown}
        placeholder="正在输入......"
      />
      <div className={styles.btnContainer}>
        <Button type="primary" onClick={handleSubmit}>提交</Button>
      </div>
    </>
  )
}
