import { NextResponse } from "next/server";
import { getSearchStats } from "@/utils/search";

/**
 * 获取检索统计信息
 * GET /api/docSearch/stats
 */
export async function GET() {
  try {
    const stats = await getSearchStats();
    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("获取统计失败:", error);
    return NextResponse.json(
      { error: "获取统计失败", details: error instanceof Error ? error.message : "未知错误" },
      { status: 500 }
    );
  }
}
