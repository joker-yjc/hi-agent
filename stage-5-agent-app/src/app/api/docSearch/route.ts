import { NextRequest, NextResponse } from "next/server";
import { searchDocuments, SearchResult } from "@/utils/search";
import { generateText } from "ai";
import { qwen } from "shared-utils";

/**
 * 构建 RAG Prompt
 */
function buildRAGPrompt(query: string, contexts: SearchResult[]): string {
  const contextText = contexts
    .map((ctx, idx) => `[文档${idx + 1}] ${ctx.fileName}\n${ctx.text}`)
    .join("\n\n---\n\n");

  return `你是一个专业的文档助手。请基于以下检索到的文档内容，回答用户的问题。

## 检索到的相关文档：

${contextText}

## 用户问题：
${query}

## 回答要求：
1. 基于上述文档内容回答问题
2. 如果文档中没有相关信息，请明确说明
3. 回答要准确、简洁、有条理
4. 可以适当引用文档中的关键信息

请回答：`;
}

/**
 * 文档检索接口（带 RAG 生成）
 * POST /api/docSearch
 * Body: { query: string, topK?: number, minScore?: number, filterFileName?: string, generateAnswer?: boolean }
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { query, topK, minScore, filterFileName, generateAnswer = true } = body;

    if (!query || typeof query !== "string" || query.trim() === "") {
      return NextResponse.json(
        { error: "缺少有效的查询文本" },
        { status: 400 }
      );
    }

    // 1. 检索相关文档
    console.log(`[RAG] 开始检索: "${query}"`);
    const searchStartTime = Date.now();
    const results: SearchResult[] = await searchDocuments(query.trim(), {
      topK: typeof topK === "number" ? topK : 5,
      minScore: typeof minScore === "number" ? minScore : 0.5,
      filterFileName,
    });
    const searchEndTime = Date.now();
    console.log(`[RAG] 检索完成: 找到 ${results.length} 个结果, 耗时 ${searchEndTime - searchStartTime}ms`);

    // 2. 如果不需要生成回答，直接返回检索结果
    if (!generateAnswer || results.length === 0) {
      const totalTime = Date.now() - startTime;
      console.log(`[RAG] 请求完成(无AI生成): 总耗时 ${totalTime}ms`);
      return NextResponse.json({
        success: true,
        query,
        results,
        total: results.length,
        answer: results.length === 0 ? null : undefined,
        timing: {
          search: searchEndTime - searchStartTime,
          llm: 0,
          total: totalTime,
        },
      });
    }

    // 3. 调用大模型生成 RAG 回答
    console.log(`[RAG] 开始调用大模型生成回答...`);
    const llmStartTime = Date.now();
    const provider = qwen();
    const prompt = buildRAGPrompt(query, results);

    const { text: answer } = await generateText({
      model: provider("qwen3-max"),
      prompt,
      temperature: 0.7,
      maxOutputTokens: 2000,
    });
    const llmEndTime = Date.now();
    const llmDuration = llmEndTime - llmStartTime;
    console.log(`[RAG] 大模型生成完成: 耗时 ${llmDuration}ms, 回答长度 ${answer.length} 字符`);

    const totalTime = Date.now() - startTime;
    console.log(`[RAG] 请求完成: 检索 ${searchEndTime - searchStartTime}ms + LLM ${llmDuration}ms = 总耗时 ${totalTime}ms`);

    return NextResponse.json({
      success: true,
      query,
      results,
      total: results.length,
      answer,
      timing: {
        search: searchEndTime - searchStartTime,
        llm: llmDuration,
        total: totalTime,
      },
    });
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`[RAG] 请求失败: 耗时 ${totalTime}ms`, error);
    return NextResponse.json(
      { error: "检索失败", details: error instanceof Error ? error.message : "未知错误" },
      { status: 500 }
    );
  }
}


