"use client";

import { useState, useEffect } from "react";
import { Input, Button, Card, List, Tag, Typography, Space, message, Statistic, Row, Col, Empty } from "antd";
import { SearchOutlined, FileTextOutlined, ClockCircleOutlined, ReloadOutlined, RobotOutlined, BookOutlined } from "@ant-design/icons";
import Markdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";

const { Title, Text, Paragraph } = Typography;

interface SearchResult {
  text: string;
  score: number;
  fileName: string;
  sourceFilePath: string;
  processedAt: string;
  chunkIndex: number;
  totalChunks: number;
}

interface SearchResponse {
  success: boolean;
  query: string;
  results: SearchResult[];
  total: number;
  answer?: string | null;
}

interface Stats {
  totalDocuments: number;
  totalChunks: number;
  files: Array<{
    fileName: string;
    chunkCount: number;
    processedAt: string;
  }>;
}

export default function DocSearchPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [answer, setAnswer] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // 加载统计信息
  const loadStats = async () => {
    try {
      const res = await fetch("/api/docSearch/stats");
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error("加载统计失败:", error);
    }
  };

  // 初始化加载统计
  useEffect(() => {
    loadStats();
  }, []);

  // 重置检索
  const handleReset = () => {
    setQuery("");
    setResults([]);
    setAnswer(null);
    setHasSearched(false);
  };

  // 执行检索
  const handleSearch = async () => {
    if (!query.trim()) {
      message.warning("请输入查询内容");
      return;
    }

    setLoading(true);
    setHasSearched(true);
    setResults([]);

    try {
      const res = await fetch("/api/docSearch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), topK: 10 }),
      });

      const data: SearchResponse = await res.json();

      if (data.success) {
        setResults(data.results);
        setAnswer(data.answer || null);
        if (data.results.length === 0) {
          message.info("未找到相关内容，请尝试其他关键词");
        }
      } else {
        message.error(data.error || "检索失败");
      }
    } catch (error) {
      console.error("检索失败:", error);
      message.error("检索请求失败");
    } finally {
      setLoading(false);
    }
  };

  // 渲染检索结果
  const renderResult = (result: SearchResult, index: number) => {
    const scoreColor = result.score >= 0.8 ? "green" : result.score >= 0.6 ? "orange" : "red";

    return (
      <Card
        key={`${result.fileName}-${result.chunkIndex}-${index}`}
        size="small"
        style={{ marginBottom: 12 }}
        styles={{ body: { padding: 16 } }}
      >
        <Space direction="vertical" size="small" style={{ width: "100%" }}>
          <Space style={{ justifyContent: "space-between", width: "100%" }}>
            <Space>
              <FileTextOutlined />
              <Text strong>{result.fileName}</Text>
              <Tag color="blue">Chunk {result.chunkIndex + 1}/{result.totalChunks}</Tag>
            </Space>
            <Tag color={scoreColor}>
              相似度: {(result.score * 100).toFixed(1)}%
            </Tag>
          </Space>

          <Paragraph
            ellipsis={{ rows: 4, expandable: true, symbol: "展开" }}
            style={{ marginBottom: 0, fontSize: 14 }}
          >
            {result.text}
          </Paragraph>

          <Space>
            <ClockCircleOutlined style={{ color: "#999" }} />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {new Date(result.processedAt).toLocaleString()}
            </Text>
          </Space>
        </Space>
      </Card>
    );
  };

  return (
    <div style={{ padding: 24, }}>
      <Title level={4}>📚 文档检索</Title>

      {/* 统计信息 */}
      {stats && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="已处理文档"
                value={stats.totalDocuments}
                prefix={<FileTextOutlined />}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="总文本块数"
                value={stats.totalChunks}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="已索引文件"
                value={stats.files.length}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 搜索框 */}
      <Card style={{ marginBottom: 24 }}>
        <Space.Compact style={{ width: "100%" }}>
          <Input
            placeholder="输入问题进行检索..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onPressEnter={handleSearch}
            size="large"
            prefix={<SearchOutlined style={{ color: "#999" }} />}
          />
          <Button
            type="primary"
            size="large"
            onClick={handleSearch}
            loading={loading}
            icon={<SearchOutlined />}
          >
            检索
          </Button>
          {hasSearched && (
            <Button
              size="large"
              onClick={handleReset}
              icon={<ReloadOutlined />}
            >
              重置
            </Button>
          )}
        </Space.Compact>
      </Card>

      {/* AI 回答 */}
      {hasSearched && !loading && answer && (
        <Card
          style={{ marginBottom: 24 }}
          styles={{ body: { padding: 20 } }}
        >
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <Space>
              <RobotOutlined style={{ fontSize: 20, color: "#1890ff" }} />
              <Title level={5} style={{ margin: 0 }}>AI 回答</Title>
            </Space>
            <div style={{ fontSize: 15, lineHeight: 1.8, padding: "0px 15px" }}>
              <Markdown
                rehypePlugins={[rehypeHighlight]}
                components={{
                  pre: ({ children }) => (
                    <pre style={{
                      background: "#f6f8fa",
                      padding: 16,
                      borderRadius: 8,
                      overflow: "auto"
                    }}>{children}</pre>
                  ),
                  code: ({ children }) => (
                    <code style={{
                      background: "#f6f8fa",
                      padding: "2px 6px",
                      borderRadius: 4,
                      fontFamily: "monospace"
                    }}>{children}</code>
                  ),
                }}
              >
                {answer}
              </Markdown>
            </div>
          </Space>
        </Card>
      )}

      {/* 检索结果 */}
      {hasSearched && (
        <div>
          <Title level={5}>
            <BookOutlined style={{ marginRight: 8 }} />
            参考文档 {!loading && results.length > 0 && `(${results.length} 条)`}
          </Title>

          {loading ? (
            <Card>
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <SearchOutlined style={{ fontSize: 48, color: "#1890ff" }} />
                <p style={{ marginTop: 16, color: "#666" }}>正在检索并生成回答...</p>
              </div>
            </Card>
          ) : results.length > 0 ? (
            <List
              dataSource={results}
              renderItem={renderResult}
            />
          ) : (
            <Empty
              description="未找到相关内容"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )}
        </div>
      )}

      {/* 提示信息 */}
      {!hasSearched && (
        <Card>
          <Title level={5}>使用提示</Title>
          <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
            <li>输入问题或关键词进行文档检索</li>
            <li>检索会返回最相关的文本块，按相似度排序</li>
            <li>可以检索已上传并处理过的所有文档</li>
            <li>如果未找到结果，请尝试使用更通用的关键词</li>
          </ul>
        </Card>
      )}
    </div>
  );
}
