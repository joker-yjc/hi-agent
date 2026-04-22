import { z } from 'zod';
import { generateText, tool, stepCountIs } from 'ai';
import { qwen } from "shared-utils";

const model = qwen();

async function main() {

  const result = await generateText({
    model: model("qwen3-max"),
    tools: {
      getTime: tool({
        description: '获取当前时间',
        inputSchema: z.object({}),
        execute: async () => ({
          time: new Date().toLocaleString(),
        }),
      }),
    },
    stopWhen: stepCountIs(5),
    prompt: '当前几点了？',
  });

  console.log(result.content, result.steps);
}


main();
