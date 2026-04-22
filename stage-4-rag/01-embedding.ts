import { openai } from "shared-utils"
import { embed } from 'ai'

const model = openai()

async function main() {
  const { embedding } = await embed({
    model: model.embedding("text-embedding-v3"),
    value: "猫是一种可爱的宠物",
  })

  console.log('✅ 成功生成 Embedding');
  console.log('📊 向量维度:', embedding.length);
  console.log('🔢 前 10 个数值:', embedding.slice(0, 10));
}

main()
