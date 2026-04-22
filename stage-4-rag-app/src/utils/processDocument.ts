import { chunkText } from "./chunkText";
import { extractText } from "./extractText";
import { generateEmbeddings, type EmbeddingOptions, type EmbeddingResult } from "./embedding";
import { DOCUMENT_PROCESSING_CONFIG } from "@/config/documentProcessing";

/**
 * 文档处理结果
 */
export interface ProcessedDocument {
  /** 文件名 */
  fileName: string;
  /** 文件路径（如果从文件处理） */
  filePath?: string;
  /** 文件 MIME 类型 */
  mimeType: string;
  /** 提取的完整文本 */
  fullText: string;
  /** 分块后的文本数组 */
  chunks: string[];
  /** 向量嵌入结果 */
  embedding: EmbeddingResult;
  /** 处理统计信息 */
  stats: {
    /** 总字符数 */
    totalChars: number;
    /** 分块数量 */
    chunkCount: number;
    /** Embedding token 使用量 */
    embeddingTokens?: number;
  };
}

/**
 * 文档处理配置选项
 */
export interface ProcessDocumentOptions {
  /** 分块配置 */
  chunking?: {
    /** 每个块的最大字符数 */
    maxSize?: number;
    /** 块之间的重叠字符数 */
    overlap?: number;
  };
  /** Embedding 配置 */
  embedding?: EmbeddingOptions;
}

/**
 * 自定义错误类 - 文档处理错误
 */
export class DocumentProcessingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "DocumentProcessingError";
  }
}

/**
 * 自定义错误类 - 文本提取错误
 */
export class TextExtractionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "TextExtractionError";
  }
}

/**
 * 通用文档处理管道 - 从 Buffer 处理（推荐用于上传流程，避免重复文件读写）
 * @param buffer 文件内容 Buffer
 * @param fileName 文件名
 * @param mimeType 文件 MIME 类型
 * @param options 处理配置选项
 * @returns 处理后的文档结果
 * @throws {TextExtractionError} 文本提取失败
 * @throws {DocumentProcessingError} 文档处理失败
 */
export async function processDocumentFromBuffer(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  options?: ProcessDocumentOptions
): Promise<ProcessedDocument> {
  // 1. 提取文本（直接从 Buffer）
  let fullText: string;
  try {
    fullText = await extractText(buffer, mimeType);
  } catch (error) {
    // 增强错误信息，提供更具体的错误类型
    if (error instanceof Error) {
      throw new TextExtractionError(
        `文件 "${fileName}" 文本提取失败: ${error.message}`,
        "EXTRACTION_FAILED",
        { fileName, mimeType, originalError: error.message }
      );
    }
    throw new TextExtractionError(
      `文件 "${fileName}" 文本提取失败: 未知错误`,
      "EXTRACTION_FAILED",
      { fileName, mimeType }
    );
  }

  // 验证提取的文本是否有效
  if (!fullText || fullText.trim().length === 0) {
    throw new DocumentProcessingError(
      `文件 "${fileName}" 未提取到有效文本内容，可能是扫描版 PDF 或图片文件`,
      "EMPTY_CONTENT",
      { fileName, mimeType }
    );
  }

  // 2. 分块（使用配置或选项中的值）
  const { maxSize = DOCUMENT_PROCESSING_CONFIG.chunking.maxSize, overlap = DOCUMENT_PROCESSING_CONFIG.chunking.overlap } = options?.chunking || {};
  const chunks = chunkText(fullText, maxSize, overlap);

  // 验证分块结果
  if (chunks.length === 0) {
    throw new DocumentProcessingError(
      `文件 "${fileName}" 文本分块失败，未生成任何块`,
      "CHUNKING_FAILED",
      { fileName, textLength: fullText.length }
    );
  }

  // 3. 生成 Embedding
  let embeddingResult: EmbeddingResult;
  try {
    embeddingResult = await generateEmbeddings(chunks, options?.embedding);
  } catch (error) {
    if (error instanceof Error) {
      throw new DocumentProcessingError(
        `文件 "${fileName}" Embedding 生成失败: ${error.message}`,
        "EMBEDDING_FAILED",
        { fileName, originalError: error.message }
      );
    }
    throw new DocumentProcessingError(
      `文件 "${fileName}" Embedding 生成失败: 未知错误`,
      "EMBEDDING_FAILED",
      { fileName }
    );
  }

  // 验证 Embedding 结果
  if (embeddingResult.embeddings.length !== chunks.length) {
    throw new DocumentProcessingError(
      `文件 "${fileName}" Embedding 数量不匹配，预期 ${chunks.length} 个，实际 ${embeddingResult.embeddings.length} 个`,
      "EMBEDDING_MISMATCH",
      { fileName, expected: chunks.length, actual: embeddingResult.embeddings.length }
    );
  }

  // 4. 返回完整结果
  return {
    fileName,
    mimeType,
    fullText,
    chunks: embeddingResult.chunks,
    embedding: embeddingResult,
    stats: {
      totalChars: fullText.length,
      chunkCount: chunks.length,
      embeddingTokens: embeddingResult.usage?.tokens,
    },
  };
}

/**
 * 通用文档处理管道 - 从文件路径处理（兼容旧场景）
 * @param filePath 文件路径
 * @param fileName 文件名
 * @param mimeType 文件 MIME 类型
 * @param options 处理配置选项
 * @returns 处理后的文档结果
 */
export async function processDocument(
  filePath: string,
  fileName: string,
  mimeType: string,
  options?: ProcessDocumentOptions
): Promise<ProcessedDocument> {
  const result = await processDocumentFromBuffer(
    // 这里使用文件路径作为 source 传入，extractText 会处理
    filePath as unknown as Buffer,
    fileName,
    mimeType,
    options
  );
  return {
    ...result,
    filePath,
  };
}