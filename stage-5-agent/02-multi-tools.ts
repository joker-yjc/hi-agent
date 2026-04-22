import z from "zod";
import { qwen } from "shared-utils";
import { generateText, stepCountIs, tool } from "ai";

const model = qwen();

const queryWeather = tool({
  description: "查询当地天气",
  inputSchema: z.object({
    location: z.string().describe("The location to query weather for"),
  }),
  execute: async ({ location }) => ({
    location,
    temperature: 72 + Math.floor(Math.random() * 21) - 10,
  }),
});

const calculate = tool({
  description: "加法计算",
  inputSchema: z.object({
    a: z.string().describe("参数a"),
    b: z.string().describe("参数b"),
  }),
  execute: async ({ a, b }) => ({
    a,
    b,
    result: Number(a) + Number(b),
  }),
});

const summarize = tool({
  description: "文本摘要",
  inputSchema: z.object({
    text: z.string().describe("要摘要的文本"),
  }),
  execute: async ({ text }) => ({
    text,
    summary: text.substring(0, 10),
  }),
});



async function main() {
  const result = await generateText({
    model: model("qwen3-max"),
    tools: {
      queryWeather,
      calculate,
      summarize,
    },
    stopWhen: stepCountIs(5),
    prompt: "今天的天气怎么样，然后再帮我总结一下这个问题?",
  });
  console.log(result.content, result.response.messages);
}

main();
