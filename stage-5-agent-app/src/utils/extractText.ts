import { readFile } from "fs/promises";
import mammoth from "mammoth";

/**
 * 从文件中提取文本内容（支持两种方式）
 * 方式1: 传入文件路径（从文件读取）
 * 方式2: 传入 Buffer（已加载到内存的内容）
 */
export async function extractText(
  source: string | Buffer,
  mimeType: string
): Promise<string> {
  // 根据 source 类型决定如何获取 buffer
  const buffer = Buffer.isBuffer(source) 
    ? source 
    : await readFile(source);

  switch (mimeType) {
    case "application/pdf":
      return await extractPdfText(buffer);
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return await extractDocxText(buffer);
    case "text/plain":
    case "text/markdown":
      return buffer.toString("utf-8");
    default:
      throw new Error(`不支持的文件类型: ${mimeType}`);
  }
}

/**
 * 从 PDF Buffer 中提取文本
 * 使用 pdf-parse-new 库
 */
async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const pdfParse = await import("pdf-parse-new");
    const result = await pdfParse.default(buffer);
    return result.text;
  } catch (error) {
    throw new Error(
      `PDF 文本提取失败: ${error instanceof Error ? error.message : "未知错误"}`
    );
  }
}

/**
 * 从 DOCX Buffer 中提取文本
 */
async function extractDocxText(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    throw new Error(
      `DOCX 文本提取失败: ${error instanceof Error ? error.message : "未知错误"}`
    );
  }
}
