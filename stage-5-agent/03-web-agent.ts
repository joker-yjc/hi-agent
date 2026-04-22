import { generateText, stepCountIs } from 'ai';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { qwen } from 'shared-utils';
import { webSearch, fetchPage, summarize } from './tools';

const __dirname = dirname(fileURLToPath(import.meta.url));
const model = qwen();

/**
 * 网页搜索 Agent
 *
 * 功能：
 * 1. web_search — 搜索关键词获取相关网页
 * 2. fetch_page — 获取指定网页的详细内容
 * 3. summarize — 对长文本进行摘要
 *
 * Agent 决策链示例：
 * 用户提问 → LLM 判断需要搜索 → 调用 web_search
 *           → 获取搜索结果 → LLM 判断需要深入了解 → 调用 fetch_page
 *           → 获取网页内容 → 内容太长 → 调用 summarize
 *           → 生成最终回答
 */

function loadSystemPrompt(): string {
  const promptPath = resolve(__dirname, 'prompts/web-agent.md');
  return readFileSync(promptPath, 'utf-8');
}

async function main() {
  const systemPrompt = loadSystemPrompt();

  const questions = [
    'Node.js 最新版本有什么新特性？',
    '简单介绍一下 React 19 的新功能',
    'Ollama 是什么，能做什么？',
  ];

  for (const question of questions) {
    console.log('\n========================================');
    console.log(`用户提问: ${question}`);
    console.log('========================================\n');

    const result = await generateText({
      model: model('qwen3-max'),
      tools: {
        web_search: webSearch,
        fetch_page: fetchPage,
        summarize: summarize,
      },
      stopWhen: stepCountIs(5),
      system: systemPrompt,
      prompt: question,
    });

    console.log('\n----- Agent 最终回答 -----');
    console.log(result.text);
    console.log('\n----- 工具调用记录 -----');
    console.log(`共执行 ${result.steps.length} 步`);
    for (const step of result.steps) {
      console.log(`\n第 ${step.stepNumber} 步:`);
      if (step.toolCalls && step.toolCalls.length > 0) {
        for (const toolCall of step.toolCalls) {
          console.log(`  → 调用工具: ${toolCall.toolName}`);
          console.log(`    参数: ${JSON.stringify(toolCall.input)}`);
        }
      }
      if (step.toolResults && step.toolResults.length > 0) {
        for (const toolResult of step.toolResults) {
          console.log(`  ← 工具返回: ${toolResult.toolName}`);
        }
      }
    }
  }

  console.log('\n========================================');
  console.log('所有测试完成！');
  console.log('========================================');
}

main().catch(console.error);