import { deleteSession, getAllSessions, updateSessionTitle } from '@/app/_utils/historyTalk'
import { PicLeftOutlined, PicRightOutlined, SmallDashOutlined } from '@ant-design/icons'
import { Button, Drawer, Dropdown, Input, List, MenuProps, Modal, Typography } from 'antd'
import React, { useContext, useEffect, useState } from 'react'
import PageContext from "../../_context"

export default function HistoryDrawer() {
  const [visible, setVisible] = React.useState(false)
  const { sessionId, setCurrentSessionId } = useContext(PageContext)
  const [allSessions, setAllSessions] = React.useState(() => getAllSessions())
  const [renameModalOpen, setRenameModalOpen] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [activeSessionId, setActiveSessionId] = useState<string>('')

  const handleClose = () => {
    setVisible(false)
  }

  const handleOpen = () => {
    setVisible(true)
  }

  useEffect(() => {
    setAllSessions(getAllSessions())
  }, [visible])

  const handleRename = (id: string, title: string) => {
    setActiveSessionId(id)
    setRenameValue(title)
    setRenameModalOpen(true)
  }

  const handleRenameConfirm = () => {
    if (activeSessionId && renameValue.trim()) {
      updateSessionTitle(activeSessionId, renameValue.trim())
      setAllSessions(getAllSessions())
    }
    setRenameModalOpen(false)
    setRenameValue('')
    setActiveSessionId('')
  }

  const handleRenameCancel = () => {
    setRenameModalOpen(false)
    setRenameValue('')
    setActiveSessionId('')
  }

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后无法恢复，是否继续？',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        deleteSession(id)
        if (sessionId === id) {
          setCurrentSessionId('')
        }
        setAllSessions(getAllSessions())
      },
    })
  }

  const getMenuItems = (id: string, title: string): MenuProps['items'] => [
    {
      key: '1',
      label: (
        <Button type="link" onClick={() => handleRename(id, title)}>
          重命名
        </Button>
      ),
    },
    {
      key: '2',
      label: (
        <Button type="link" danger onClick={() => handleDelete(id)}>
          删除
        </Button>
      ),
    },
  ];

  const handleNewChat = (id: string = "") => {
    setCurrentSessionId(id)
    handleClose()
  };
  return (
    <>
      <Drawer
        open={visible}
        placement="left"
        title={null}
        destroyOnHidden={true}
        closable={false}
        onClose={handleClose}
        extra={<div>Extra Content</div>}
      >
        <div style={{ padding: "10px 0", display: "flex", justifyContent: 'space-between' }}>
          <Button onClick={() => handleNewChat()}>新对话</Button>
          <PicRightOutlined onClick={handleClose} />
        </div>
        <List
          size="small"
          dataSource={allSessions}
          bordered={false}
          extra={<Button type="link">新对话</Button>}
          header={<Typography.Text type="secondary">对话历史</Typography.Text>}
          renderItem={(item) => {
            const isActive = item.id === sessionId
            return <List.Item>
              <div style={{
                display: "flex",
                width: "100%",
                padding: "5px",
                borderRadius: 4,
                backgroundColor: isActive ? "#F5F5F5" : undefined
              }}>
                <div style={{ width: "calc(100% - 20px)", cursor: "pointer", }} onClick={() => handleNewChat(item.id)}>
                  <Typography.Text ellipsis>{item.title}</Typography.Text>
                </div>
                <Dropdown menu={{ items: getMenuItems(item.id, item.title) }}>
                  <SmallDashOutlined style={{ fontWeight: 'bolder' }} />
                </Dropdown>
              </div>

            </List.Item>
          }}
        >
        </List>
      </Drawer>
      <PicLeftOutlined onClick={handleOpen} />

      <Modal
        title="重命名会话"
        open={renameModalOpen}
        onOk={handleRenameConfirm}
        onCancel={handleRenameCancel}
        okText="确认"
        cancelText="取消"
      >
        <Input
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          placeholder="请输入新名称"
          onPressEnter={handleRenameConfirm}
        />
      </Modal>
    </>
  )
}
