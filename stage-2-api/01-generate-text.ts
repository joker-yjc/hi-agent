import { generateText } from "ai"
import qwen from "shared-utils/qwen"


const alibaba = qwen()

async function main() {
  const res = await generateText({
    model: alibaba("qwen3.5-plus"),
    prompt: "你能给我解释一下大语言模型中的 Transformer 架构是什么东西吗?用最通俗易懂的话，最好是能让小学生也能听懂",
  })

  const res1 = await generateText({
    model: alibaba("qwen3.5-flash"),
    prompt: "你能给我解释一下大语言模型中的 Transformer 架构是什么东西吗?用最通俗易懂的话，最好是能让小学生也能听懂",
  })

  console.log(res.usage, res.content)
  console.log(res1.usage, res1.content)
}

main()
