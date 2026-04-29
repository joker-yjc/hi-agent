// 文档处理配置
export const DOCUMENT_PROCESSING_CONFIG = {
  // 文本分块配置
  chunking: {
    // 每个块的最大字符数
    maxSize: 800,
    // 块之间的重叠字符数
    overlap: 150
  },
  // Embedding 配置
  embedding: {
    // 模型名称
    model: "text-embedding-v3",
    // 最大重试次数
    maxRetries: 2
  },
  // 文件上传配置
  upload: {
    // 允许的文件扩展名
    allowedExtensions: [".pdf", ".txt", ".md", ".docx"] as const,
    // 允许的 MIME 类型映射（主要类型 + 备用类型，避免浏览器差异）
    allowedMimeTypes: {
      // PDF - 标准 MIME
      ".pdf": ["application/pdf"],
      // TXT - 纯文本（浏览器可能发送为 application/octet-stream）
      ".txt": ["text/plain", "application/octet-stream"],
      // MD - Markdown（部分浏览器使用 text/x-markdown）
      ".md": ["text/markdown", "text/plain", "text/x-markdown"],
      // DOCX - 标准 OpenXML MIME（部分浏览器可能发送为 application/octet-stream）
      ".docx": [
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/octet-stream"
      ]
    } as const
  }
} as const;

// 导出类型
export type AllowedExtension = typeof DOCUMENT_PROCESSING_CONFIG.upload.allowedExtensions[number];
export type AllowedMimeTypeMap = typeof DOCUMENT_PROCESSING_CONFIG.upload.allowedMimeTypes;