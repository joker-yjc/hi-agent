import { loadAllDocumentVectors } from "./vectorStore";
import { embedMany } from "ai";
import { openai } from "shared-utils";

/**
 * 计算两个向量的余弦相似度
 * @param vecA 向量 A
 * @param vecB 向量 B
 * @returns 余弦相似度值
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error("向量维度不一致");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * 单条检索结果
 */
export interface SearchResult {
  /** 文本内容 */
  text: string;
  /** 相似度分数 */
  score: number;
  /** 来源文件名 */
  fileName: string;
  /** 原始文件路径 */
  sourceFilePath: string;
  /** 处理时间 */
  processedAt: string;
  /** chunk 索引 */
  chunkIndex: number;
  /** 总 chunk 数 */
  totalChunks: number;
}

/**
 * 检索配置选项
 */
export interface SearchOptions {
  /** 返回结果数量，默认 5 */
  topK?: number;
  /** 相似度阈值，默认 0.5 */
  minScore?: number;
  /** 特定文件名过滤（可选） */
  filterFileName?: string;
  /** 模型名称 */
  model?: string;
}

/**
 * 在文档向量中检索相关内容
 * @param query 用户查询文本
 * @param options 检索配置
 * @returns 检索结果列表
 */
export async function searchDocuments(
  query: string,
  options?: SearchOptions
): Promise<SearchResult[]> {
  const { topK = 5, minScore = 0.5, filterFileName, model = "text-embedding-v3" } = options || {};

  // 加载所有文档向量
  const documents = await loadAllDocumentVectors();

  // 过滤特定文件（如果指定）
  const targetDocs = filterFileName
    ? documents.filter((doc) => doc.fileName === filterFileName)
    : documents;

  if (targetDocs.length === 0) {
    return [];
  }

  // 生成查询 embedding
  const provider = openai();
  const embeddingModel = provider.embedding(model);
  const embeddingResult = await embedMany({
    model: embeddingModel,
    values: [query],
  });
  const queryEmbedding = embeddingResult.embeddings[0];

  // 计算每个 chunk 的相似度
  const scoredChunks: SearchResult[] = [];

  for (const doc of targetDocs) {
    for (let i = 0; i < doc.records.length; i++) {
      const record = doc.records[i];
      const score = cosineSimilarity(queryEmbedding, record.embedding);

      if (score >= minScore) {
        scoredChunks.push({
          text: record.text,
          score,
          fileName: doc.fileName,
          sourceFilePath: doc.sourceFilePath,
          processedAt: doc.processedAt,
          chunkIndex: i,
          totalChunks: doc.records.length,
        });
      }
    }
  }

  // 按相似度降序排序，返回 topK
  scoredChunks.sort((a, b) => b.score - a.score);

  return scoredChunks.slice(0, topK);
}

/**
 * 获取文档检索统计信息
 * @returns 统计信息
 */
export async function getSearchStats(): Promise<{
  totalDocuments: number;
  totalChunks: number;
  files: Array<{
    fileName: string;
    chunkCount: number;
    processedAt: string;
  }>;
}> {
  const documents = await loadAllDocumentVectors();

  return {
    totalDocuments: documents.length,
    totalChunks: documents.reduce((sum, doc) => sum + doc.chunkCount, 0),
    files: documents.map((doc) => ({
      fileName: doc.fileName,
      chunkCount: doc.chunkCount,
      processedAt: doc.processedAt,
    })),
  };
}
