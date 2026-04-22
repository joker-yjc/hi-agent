'use client';

import React, { useState, useEffect } from 'react';
import { Upload, message, Card, Typography, Space, Table, Button, Popconfirm, Tag } from 'antd';
import { InboxOutlined, FileTextOutlined, DeleteOutlined, ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';
import type { ColumnsType } from 'antd/es/table';

import styles from './page.module.css';

const { Dragger } = Upload;
const { Title, Text } = Typography;

/**
 * 文件信息类型定义
 */
interface FileInfo {
  fileName: string;
  fullPath: string;
  size: number;
  uploadTime: string;
  url: string;
  hasVector: boolean;
}

const Page = () => {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);

  /**
   * 获取已上传文件列表
   */
  const fetchUploadedFiles = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/docsList');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '获取文件列表失败');
      }

      setUploadedFiles(data.files);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '获取文件列表失败';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 组件加载时获取文件列表
  useEffect(() => {
    fetchUploadedFiles();
  }, []);

  /**
   * 处理文件上传请求
   */
  const handleUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/docsEmbedding', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '上传失败');
      }

      return data;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '上传失败';
      message.error(errorMessage);
      throw error;
    }
  };

  /**
   * 删除已上传的文件
   */
  const handleDelete = async (fullPath: string) => {
    try {
      const res = await fetch('/api/docsList', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileName: fullPath }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '删除失败');
      }

      message.success('文件删除成功');
      fetchUploadedFiles(); // 刷新列表
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '删除失败';
      message.error(errorMessage);
    }
  };

  /**
   * 格式化文件大小
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  /**
   * 表格列定义
   */
  const columns: ColumnsType<FileInfo> = [
    {
      title: '文件名',
      dataIndex: 'fileName',
      key: 'fileName',
      ellipsis: true,
    },
    {
      title: '文件大小',
      dataIndex: 'size',
      key: 'size',
      width: 120,
      render: (size: number) => formatFileSize(size),
    },
    {
      title: '向量数据',
      dataIndex: 'hasVector',
      key: 'hasVector',
      width: 100,
      render: (hasVector: boolean) => hasVector ? (
        <Tag icon={<CheckCircleOutlined />} color="success">已生成</Tag>
      ) : (
        <Tag icon={<CloseCircleOutlined />} color="default">未生成</Tag>
      ),
    },
    {
      title: '上传时间',
      dataIndex: 'uploadTime',
      key: 'uploadTime',
      width: 180,
      render: (time: string) => new Date(time).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Popconfirm
          title="确定要删除此文件吗？"
          onConfirm={() => handleDelete(record.fullPath)}
          okText="确定"
          cancelText="取消"
        >
          <Button type="link" danger icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  const uploadProps = {
    name: 'file',
    multiple: true,
    accept: '.pdf,.txt,.md,.docx',
    fileList,
    /**
     * 自定义上传逻辑
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    customRequest: async (options: any) => {
      const { file, onSuccess, onError } = options;
      setUploading(true);
      try {
        if (!(file instanceof File)) {
          throw new Error('不支持的文件格式');
        }
        const data = await handleUpload(file);
        onSuccess?.(data);
        fetchUploadedFiles(); // 上传成功后刷新列表
      } catch (error) {
        onError?.(error);
      } finally {
        setUploading(false);
      }
    },
    /**
     * 文件状态变化时的回调
     */
    onChange: (info: { fileList: UploadFile[]; file: UploadFile }) => {
      setFileList(info.fileList);

      const { status } = info.file;
      if (status === 'done') {
        message.success(`${info.file.name} 文件上传成功`);
      } else if (status === 'error') {
        message.error(`${info.file.name} 文件上传失败`);
      }
    },
    /**
     * 文件移除时的回调
     */
    onRemove: (file: UploadFile) => {
      const newFileList = fileList.filter(item => item.uid !== file.uid);
      setFileList(newFileList);
    },
  };

  return (
    <div className={styles.main}>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        {/* 上传区域 */}
        <Card className={styles.card}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div style={{ textAlign: 'center' }}>
              <Title level={3}>
                <FileTextOutlined /> 文档上传
              </Title>
              <Text type="secondary">
                上传 PDF、TXT、MD 或 DOCX 文件进行资料录入
              </Text>
            </div>

            <Dragger {...uploadProps}>
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到此区域</p>
              <p className="ant-upload-hint">
                支持 PDF、TXT、MD、DOCX 格式，可批量上传
              </p>
            </Dragger>
          </Space>
        </Card>

        {/* 已上传文件列表 */}
        <Card
          className={styles.card}
          title="已上传文件列表"
          extra={
            <Button
              type="link"
              icon={<ReloadOutlined spin={loading} />}
              onClick={fetchUploadedFiles}
            >
              刷新
            </Button>
          }
        >
          <Table
            columns={columns}
            dataSource={uploadedFiles}
            rowKey="fullPath"
            loading={loading}
            locale={{ emptyText: '暂无已上传文件' }}
            pagination={{ pageSize: 10 }}
          />
        </Card>
      </Space>
    </div>
  );
}

export default Page;
