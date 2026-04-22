import { embedMany } from "ai";
import { openai } from "shared-utils";

/**
 * 阿里云 Embedding 模型单次最大 chunk 数量限制
 */
const MAX_CHUNKS_PER_REQUEST = 10;

/**
 * Embedding 配置选项
 */
export interface EmbeddingOptions {
  /** 模型名称 */
  model?: string;
  /** 最大重试次数 */
  maxRetries?: number;
}

/**
 * Embedding 结果
 */
export interface EmbeddingResult {
  /** 向量数组 */
  embeddings: number[][];
  /** 原始文本块 */
  chunks: string[];
  /** 总 token 使用量 */
  usage?: {
    tokens: number;
  };
}

/**
 * 为文本块生成向量嵌入（自动分批处理，每批最多 10 个 chunk）
 * @param chunks 文本块数组
 * @param options Embedding 配置
 * @returns Embedding 结果
 */
export async function generateEmbeddings(
  chunks: string[],
  options?: EmbeddingOptions
): Promise<EmbeddingResult> {
  if (chunks.length === 0) {
    return { embeddings: [], chunks: [] };
  }

  const {
    model = "text-embedding-v3",
    maxRetries = 2,
  } = options || {};

  const provider = openai();
  const embeddingModel = provider.embedding(model);

  const allEmbeddings: number[][] = [];
  let totalTokens = 0;

  // 分批处理，每批最多 10 个 chunk
  for (let i = 0; i < chunks.length; i += MAX_CHUNKS_PER_REQUEST) {
    const batch = chunks.slice(i, i + MAX_CHUNKS_PER_REQUEST);

    const result = await embedMany({
      model: embeddingModel,
      values: batch,
      maxRetries,
    });

    // embeddings 已经是 number[][] 类型，直接使用
    allEmbeddings.push(...result.embeddings);
    if (result.usage) {
      totalTokens += result.usage.tokens;
    }
  }

  return {
    embeddings: allEmbeddings,
    chunks,
    usage: { tokens: totalTokens },
  };
}
