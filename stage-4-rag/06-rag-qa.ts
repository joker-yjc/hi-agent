import { generateText } from 'ai';
import { search } from './05-search';
import { qwen } from "shared-utils";

const model = qwen();

/**
 * RAG 问答：检索相关文档 → 拼入 Prompt → LLM 生成回答
 */
export async function ragQA(question: string) {
  // 1. 检索相关文档块
  const results = await search(question);

  console.log(`\n🔍 检索到 ${results.length} 个相关文档块：`);
  results.forEach((item, index) => {
    console.log(`  ${index + 1}. [${item.sourceFile}:块${item.chunkIndex}] 相似度: ${item.similarity.toFixed(3)}`);
  });

  // 2. 构建带引用来源的参考资料文本
  const contextText = results
    .map((item, i) => `[参考 ${i + 1}]（来源: ${item.sourceFile}, 块 ${item.chunkIndex}, 相关度: ${item.similarity.toFixed(3)}）\n${item.content}`)
    .join('\n\n');

  // 3. 构建 Prompt
  const systemPrompt = `你是一个技术助手。请根据以下参考资料回答用户的问题。

<参考资料>
${contextText || '（没有找到相关参考资料）'}
</参考资料>

<要求>
- 仅基于参考资料回答
- 如果参考资料不足以回答问题，请明确说明"没有找到相关信息"
- 回答要简洁准确
- 在回答末尾标注引用来源，格式如：[参考 1]、[参考 2]
</要求>`;

  // 4. 调用 LLM 生成回答
  const { text } = await generateText({
    model: model("qwen-plus"),
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: question }
    ],
  });

  console.log(`\n💡 回答：\n${text}`);


  return {
    answer: text,
    sources: results.map(item => ({
      sourceFile: item.sourceFile,
      chunkIndex: item.chunkIndex,
      similarity: item.similarity,
    })),
  };
}

// 运行示例
async function main() {
  const question = "Agent开发学习计划的day12内容是什么";
  console.log(`❓ 问题: ${question}`);

  await ragQA(question);
}

main();
