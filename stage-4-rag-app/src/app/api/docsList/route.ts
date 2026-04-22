import { NextRequest, NextResponse } from "next/server";
import { readdir, stat, unlink } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

/**
 * 检查向量文件是否存在（使用保存的文件名）
 * @param savedFileName 保存的文件名（包含时间戳）
 */
function hasVectorFile(savedFileName: string): boolean {
  const vectorDir = join(process.cwd(), "public", "vectors");
  if (!existsSync(vectorDir)) {
    return false;
  }

  // 使用保存的文件名（将 - 转为 _）精确匹配
  const id = savedFileName.replace("-", "_");
  return existsSync(join(vectorDir, `${id}.json`));
}

/**
 * 删除向量文件（使用保存的文件名）
 * @param savedFileName 保存的文件名（包含时间戳）
 */
async function deleteVectorFile(savedFileName: string): Promise<boolean> {
  const vectorDir = join(process.cwd(), "public", "vectors");
  if (!existsSync(vectorDir)) {
    return false;
  }

  const id = savedFileName.replace("-", "_");
  const targetPath = join(vectorDir, `${id}.json`);
  
  if (existsSync(targetPath)) {
    await unlink(targetPath);
    return true;
  }
  return false;
}

/**
 * 获取已上传文件列表接口
 */
export async function GET() {
  try {
    const uploadDir = join(process.cwd(), "public", "uploads");

    if (!existsSync(uploadDir)) {
      return NextResponse.json({
        success: true,
        files: [],
      });
    }

    const files = await readdir(uploadDir);

    const fileList = await Promise.all(
      files.map(async (fileName) => {
        const filePath = join(uploadDir, fileName);
        const fileStat = await stat(filePath);

        const originalFileName = fileName.replace(/^\d+-/, "");

        // 使用保存的文件名（包含时间戳）检查向量文件
        const hasVector = hasVectorFile(fileName);

        return {
          fileName: originalFileName,
          fullPath: fileName,
          size: fileStat.size,
          uploadTime: fileStat.mtime,
          url: `/uploads/${fileName}`,
          hasVector,
        };
      })
    );

    fileList.sort((a, b) => b.uploadTime.getTime() - a.uploadTime.getTime());

    return NextResponse.json({
      success: true,
      files: fileList,
    });
  } catch (error) {
    console.error("获取文件列表失败:", error);
    return NextResponse.json(
      { error: "获取文件列表失败" },
      { status: 500 }
    );
  }
}

/**
 * 删除已上传文件接口
 */
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileName } = body;

    if (!fileName) {
      return NextResponse.json(
        { error: "缺少文件名参数" },
        { status: 400 }
      );
    }

    const uploadDir = join(process.cwd(), "public", "uploads");
    const filePath = join(uploadDir, fileName);

    // 删除原始文件
    await unlink(filePath);

    // 使用保存的文件名（包含时间戳）删除对应的向量数据文件
    await deleteVectorFile(fileName);

    return NextResponse.json({
      success: true,
      message: "文件删除成功",
    });
  } catch (error) {
    console.error("删除文件失败:", error);
    return NextResponse.json(
      { error: "删除文件失败" },
      { status: 500 }
    );
  }
}
