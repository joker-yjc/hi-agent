import { Select } from "antd";
import styles from './index.module.css'
import { PicLeftOutlined } from "@ant-design/icons";
import HistoryDrawer from "../HistoryDrawer";

interface PageHeaderProps {
  modelId?: string,
  modelChange?: (modelId: string) => void,
}

export default function PageHeader({ modelId = "qwen3-max", modelChange }: PageHeaderProps) {
  return (
    <div className={styles['chat-header']}>
      <HistoryDrawer />
      <Select
        defaultValue={modelId}
        variant="borderless"
        onChange={modelChange}
        options={[
          {
            value: 'qwen3-max',
            label: 'Qwen 3-Max',
          },
          {
            value: 'kimi-k2.5',
            label: 'Kimi K2.5',
          },
          {
            value: 'MiniMax-M2.5',
            label: 'MiniMax M2.5',
          }
        ]}></Select>
    </div>
  )
}
