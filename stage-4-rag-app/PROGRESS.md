# RAG 文档处理流程 - 实施进度

## 已完成功能

### 1. 文件上传接口
- **路径**: `src/app/api/docsEmbedding/route.ts`
- **功能**:
  - 支持 PDF、DOCX、TXT、MD 文件
  - 验证文件类型（扩展名 + MIME）
  - 生成唯一文件名（时间戳 + 原始名）

### 2. 文本提取
- **路径**: `src/utils/extractText.ts`
- **功能**:
  - PDF: 使用 pdf-parse-new
  - DOCX: 使用 mammoth
  - TXT/MD: 直接读取
  - 支持传入 Buffer 或文件路径

### 3. 文本分块
- **路径**: `src/utils/chunkText.ts`
- **功能**: 按段落分块，支持重叠区域

### 4. Embedding
- **路径**: `src/utils/embedding.ts`
- **功能**:
  - 使用阿里云 text-embedding-v3
  - 自动分批处理（每批最多 10 个 chunk）
  - 支持配置模型和重试次数

### 5. 向量存储
- **路径**: `src/utils/vectorStore.ts`
- **功能**:
  - 每个文件独立 JSON 文件
  - 使用时间戳文件名作为 ID（便于同名文件区分）

### 6. 文件列表接口
- **路径**: `src/app/api/docsList/route.ts`
- **功能**:
  - GET: 返回文件列表 + 向量状态
  - DELETE: 删除文件 + 对应向量数据

### 7. 前端页面
- **路径**: `src/app/docsUpload/page.tsx`
- **功能**:
  - Ant Design 上传组件
  - 表格显示文件列表 + 向量状态 Tag
  - 删除时同时清理向量数据

## 存储结构

```
public/
├── uploads/          # 原始文件
│   └── {timestamp}-{filename}
└── vectors/         # 向量数据
    └── {timestamp}_{filename}.json
```

## 下一步

- 实现 RAG 检索功能
- 实现文档问答功能
