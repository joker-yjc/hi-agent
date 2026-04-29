import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { processDocumentFromBuffer } from "@/utils/processDocument";
import { saveDocumentVectors } from "@/utils/vectorStore";
import { DOCUMENT_PROCESSING_CONFIG } from "@/config/documentProcessing";

/**
 * 文档上传接口
 * 将上传的文件保存到本地 public/uploads 目录
 * 并自动执行：文本提取 → 分块 → Embedding → 保存向量数据 流程
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "未找到上传文件" },
        { status: 400 }
      );
    }

    // 获取文件扩展名
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    
    // 验证文件扩展名（使用配置）
    if (!DOCUMENT_PROCESSING_CONFIG.upload.allowedExtensions.includes(ext as typeof DOCUMENT_PROCESSING_CONFIG.upload.allowedExtensions[number])) {
      return NextResponse.json(
        { error: `不支持的文件类型: ${ext}，请上传 PDF、TXT、MD 或 DOCX 文件` },
        { status: 400 }
      );
    }

    // 验证 MIME 类型（宽松模式：允许主要类型 + 备用类型如 application/octet-stream）
    const allowedMimes = DOCUMENT_PROCESSING_CONFIG.upload.allowedMimeTypes[ext as keyof typeof DOCUMENT_PROCESSING_CONFIG.upload.allowedMimeTypes];
    const isValidMime = allowedMimes?.some(mime => mime === file.type);
    if (!isValidMime) {
      return NextResponse.json(
        { error: `文件内容类型不匹配，${file.name} 可能不是有效的 ${ext.toUpperCase()} 文件` },
        { status: 400 }
      );
    }

    // 创建上传目录
    const uploadDir = join(process.cwd(), "public", "uploads");
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // 生成唯一文件名（时间戳 + 原始文件名）
    const fileName = `${Date.now()}-${file.name}`;
    const filePath = join(uploadDir, fileName);

    // 将文件转换为 Buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 执行文档处理管道（使用配置文件）
    const result = await processDocumentFromBuffer(
      buffer,
      file.name,
      file.type,
      {
        chunking: {
          maxSize: DOCUMENT_PROCESSING_CONFIG.chunking.maxSize,
          overlap: DOCUMENT_PROCESSING_CONFIG.chunking.overlap,
        },
        embedding: {
          model: DOCUMENT_PROCESSING_CONFIG.embedding.model,
          maxRetries: DOCUMENT_PROCESSING_CONFIG.embedding.maxRetries,
        },
      }
    );

    // 保存向量数据到 JSON 文件（使用相同的时间戳文件名）
    const vectorFilePath = await saveDocumentVectors(
      fileName,           // 保存的文件名（包含时间戳）
      file.name,          // 原始文件名
      `/uploads/${fileName}`,
      file.type,
      result.fullText,
      result.chunks,
      result.embedding.embeddings,
      result.embedding.usage?.tokens
    );

    // 保存原始文件到本地（处理成功后才保存）
    await writeFile(filePath, buffer);

    return NextResponse.json({
      success: true,
      fileName: file.name,
      savedFileName: fileName,
      filePath: `/uploads/${fileName}`,
      vectorFilePath,
      size: file.size,
      type: file.type,
      stats: result.stats,
    });
  } catch (error) {
    console.error("文档处理失败:", error);
    return NextResponse.json(
      { error: `文档处理失败: ${error instanceof Error ? error.message : "未知错误"}` },
      { status: 500 }
    );
  }
}