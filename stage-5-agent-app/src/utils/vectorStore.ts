import { writeFile, readFile, mkdir, readdir, unlink } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

/**
 * 向量数据存储目录
 */
const VECTOR_DIR = join(process.cwd(), "public", "vectors");

/**
 * 单条向量记录
 */
export interface VectorRecord {
  /** 文本内容 */
  text: string;
  /** 向量 */
  embedding: number[];
  /** 字符开始位置 */
  startChar?: number;
  /** 字符结束位置 */
  endChar?: number;
}

/**
 * 文档向量数据
 */
export interface DocumentVectors {
  /** 保存的文件名（包含时间戳） */
  savedFileName: string;
  /** 原始文件名 */
  fileName: string;
  /** 原始文件路径 */
  sourceFilePath: string;
  /** MIME 类型 */
  mimeType: string;
  /** 处理时间 */
  processedAt: string;
  /** 总字符数 */
  totalChars: number;
  /** 分块数量 */
  chunkCount: number;
  /** 向量记录列表 */
  records: VectorRecord[];
  /** 元数据 */
  metadata?: {
    /** Embedding token 使用量 */
    embeddingTokens?: number;
  };
}

/**
 * 生成向量文件的存储路径
 * 使用保存的文件名（包含时间戳）作为唯一标识
 * 这样同名文件通过时间戳区分
 * @param savedFileName 保存的文件名，格式：{timestamp}-{originalName}
 */
function getVectorFilePath(savedFileName: string): string {
  // 直接使用保存的文件名（去掉中间的 - 改为 _）
  const id = savedFileName.replace("-", "_");
  return join(VECTOR_DIR, `${id}.json`);
}

/**
 * 根据保存的文件名查找向量文件路径
 */
function findVectorFilePath(savedFileName: string): string | null {
  const id = savedFileName.replace("-", "_");
  const filePath = join(VECTOR_DIR, `${id}.json`);
  return existsSync(filePath) ? filePath : null;
}

/**
 * 确保向量存储目录存在
 */
async function ensureVectorDir(): Promise<void> {
  if (!existsSync(VECTOR_DIR)) {
    await mkdir(VECTOR_DIR, { recursive: true });
  }
}

/**
 * 保存文档向量数据到 JSON 文件
 * @param savedFileName 保存的文件名（包含时间戳），格式：{timestamp}-{originalName}
 * @param originalFileName 原始文件名
 * @param sourceFilePath 源文件路径
 * @param mimeType 文件类型
 * @param fullText 完整文本
 * @param chunks 分块数组
 * @param embeddings 向量数组
 * @param embeddingTokens 可选的 token 使用量
 * @returns 存储的文件路径
 */
export async function saveDocumentVectors(
  savedFileName: string,
  originalFileName: string,
  sourceFilePath: string,
  mimeType: string,
  fullText: string,
  chunks: string[],
  embeddings: number[][],
  embeddingTokens?: number
): Promise<string> {
  await ensureVectorDir();

  // 构建向量记录（按索引顺序，chunks 和 embeddings 一一对应）
  const records: VectorRecord[] = [];

  for (let i = 0; i < chunks.length; i++) {
    records.push({
      text: chunks[i],
      embedding: embeddings[i],
    });
  }

  // 构建文档向量数据
  const documentVectors: DocumentVectors = {
    fileName: originalFileName,
    savedFileName,
    sourceFilePath,
    mimeType,
    processedAt: new Date().toISOString(),
    totalChars: fullText.length,
    chunkCount: chunks.length,
    records,
    metadata: embeddingTokens ? { embeddingTokens } : undefined,
  };

  // 保存到 JSON 文件，使用保存的文件名作为 ID
  const vectorFilePath = getVectorFilePath(savedFileName);
  await writeFile(vectorFilePath, JSON.stringify(documentVectors, null, 2), "utf-8");

  return vectorFilePath;
}

/**
 * 根据保存的文件名删除对应的向量文件
 * @param savedFileName 保存的文件名（包含时间戳）
 */
export async function deleteDocumentVectors(savedFileName: string): Promise<boolean> {
  try {
    const vectorFilePath = findVectorFilePath(savedFileName);
    
    if (vectorFilePath && existsSync(vectorFilePath)) {
      await unlink(vectorFilePath);
      return true;
    }
    
    return false;
  } catch {
    return false;
  }
}

/**
 * 加载所有文档向量数据
 * @returns 所有文档向量列表
 */
export async function loadAllDocumentVectors(): Promise<DocumentVectors[]> {
  try {
    await ensureVectorDir();
    const files = await readdir(VECTOR_DIR);
    const jsonFiles = files.filter(f => f.endsWith(".json"));
    
    const documents: DocumentVectors[] = [];
    
    for (const file of jsonFiles) {
      try {
        const content = await readFile(join(VECTOR_DIR, file), "utf-8");
        const doc = JSON.parse(content) as DocumentVectors;
        documents.push(doc);
      } catch (error) {
        console.warn(`加载向量文件失败: ${file}`, error);
      }
    }
    
    // 按处理时间排序
    return documents.sort((a, b) => 
      new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime()
    );
  } catch {
    return [];
  }
}

/**
 * 根据原始文件名查找向量数据
 * @param fileName 原始文件名
 * @returns 文档向量数据或 null
 */
export async function findDocumentVectors(fileName: string): Promise<DocumentVectors | null> {
  const allDocs = await loadAllDocumentVectors();
  return allDocs.find(doc => doc.fileName === fileName) || null;
}
