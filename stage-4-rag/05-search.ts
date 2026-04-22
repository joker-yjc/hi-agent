import { openai } from "shared-utils";
import { cosineSimilarity, embed } from 'ai';
import dataSource from './index.json';

const model = openai();

interface SearchResult {
  id: string;
  content: string;
  embedding: number[];
  sourceFile: string;
  chunkIndex: number;
  similarity: number;
}

/**
 * 向量搜索：将问题转为 Embedding，计算与所有文档块的相似度，返回 Top-K
 */
export async function search(question: string, topK: number = 3): Promise<SearchResult[]> {
  // 问题转成向量
  const { embedding: questionEmbedding } = await embed({
    model: model.embedding("text-embedding-v3"),
    value: question,
  });

  // 计算所有文档块的相似度
  const results: SearchResult[] = dataSource.map(item => ({
    ...item,
    similarity: cosineSimilarity(questionEmbedding, item.embedding),
  }));

  // 按相似度降序排序，取 Top-K
  return results
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}

// 运行示例
async function main() {
  const question = "第12天的ai学习计划是怎么安排的";
  console.log(`🔍 搜索问题: ${question}\n`);

  const results = await search(question);

  console.log('📊 检索结果：');
  results.forEach((item, index) => {
    console.log(`\n--- 结果 ${index + 1} (相似度: ${item.similarity.toFixed(3)}) ---`);
    console.log(`来源: ${item.sourceFile} (块 ${item.chunkIndex})`);
    console.log(`内容: ${item.content.substring(0, 100)}...`);
  });

  return results;
}

main();
