import { streamText, ModelMessage } from "ai"
import readline from "readline"

import qwen from "shared-utils/qwen"

const alibaba = qwen()

const memory: ModelMessage[] = [
  {
    role: "system",
    content: "你是一个前端技术顾问",
  }
]

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

const question = (q: string) => {
  return new Promise<string>(resolve => {
    rl.question(q, resolve)
  })
}

async function main() {

  while (true) {
    const message = await question("请输入你的问题:")
    if (message === "exit") break
    memory.push({
      role: "user",
      content: message
    })

    const { textStream } = await streamText({
      model: alibaba("qwen3.5-plus"),
      messages: memory
    })
    let result = ""
    for await (const text of textStream) {
      result += text
      process.stdout.write(text)
    }
    memory.push({
      role: "assistant",
      content: result
    })
  }
}


main()
