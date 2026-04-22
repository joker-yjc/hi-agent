
import { streamText, convertToModelMessages } from "ai"
import { NextRequest } from "next/server";
import { qwen } from "shared-utils"


const model = qwen()

const llmMapping = {
  "qwen3-max": "qwen3-max",
  "kimi-k2.5": "kimi-k2.5",
  "MiniMax-M2.5": "MiniMax-M2.5"
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { messages, modelId } = body
  console.log(messages, modelId);
  const result = streamText({
    system: '你是一个智慧助手，竭尽全力回答用户问题，帮助用户解决问题。',
    messages: await convertToModelMessages(messages),
    model: model(llmMapping[modelId as keyof typeof llmMapping] ?? llmMapping["qwen3-max"]),
  })
  return result.toUIMessageStreamResponse();
}
