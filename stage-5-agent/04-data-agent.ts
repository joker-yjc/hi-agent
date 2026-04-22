import { generateText, stepCountIs } from 'ai';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { qwen } from 'shared-utils';
import { queryData } from './tools';

const __dirname = dirname(fileURLToPath(import.meta.url));
const model = qwen();

/**
 * 数据查询 Agent
 *
 * 功能：
 * - query_data — 查询本地 JSON 数据文件
 *
 * Agent 决策链示例：
 * 用户用自然语言提问 → LLM 理解意图 → 转换为查询参数 → 调用 query_data
 * → 获取数据 → 生成自然语言回答
 *
 * 错误处理与降级策略：
 * - 如果查询无结果，Agent 会告知用户并建议调整条件
 * - 如果文件不存在，Agent 会报错并提示检查路径
 */

const DATA_FILE = './data/products.json';

function loadSystemPrompt(): string {
  const promptPath = resolve(__dirname, 'prompts/data-agent.md');
  return readFileSync(promptPath, 'utf-8');
}

async function main() {
  const systemPrompt = loadSystemPrompt();

  const questions = [
    '有哪些笔记本电脑？按价格从低到高排列',
    'Apple 品牌的产品有哪些？',
    '价格低于 5000 的手机有哪些？',
    '库存最多的产品是什么？',
    '有哪些耳机支持降噪功能？',
  ];

  for (const question of questions) {
    console.log('\n========================================');
    console.log(`用户提问: ${question}`);
    console.log('========================================\n');

    const result = await generateText({
      model: model('qwen3-max'),
      tools: {
        query_data: queryData,
      },
      stopWhen: stepCountIs(3),
      system: `${systemPrompt}\n\n数据文件路径: ${resolve(__dirname, DATA_FILE)}`,
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
          console.log(`    参数: ${JSON.stringify(toolCall.input, null, 2)}`);
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