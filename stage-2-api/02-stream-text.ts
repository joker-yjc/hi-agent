import { streamText } from "ai"
import qwen from "shared-utils/qwen"

const alibaba = qwen()
async function main() {
  const { textStream } = await streamText({
    model: alibaba("qwen3.5-plus"),
    prompt: "你能简单的介绍一下你自己嘛？",
  })



  for await (const text of textStream) {
    process.stdout.write(text)
  }
}

main()
