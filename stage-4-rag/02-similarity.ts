import { openai } from "shared-utils"
import { embedMany, cosineSimilarity } from 'ai'

const model = openai()

async function main() {
  const { embeddings } = await embedMany({
    model: model.embedding("text-embedding-v3"),
    values: [
      "猫是一种可爱的宠物",
      "小狗是人类的好朋友",
      "汽车是一种交通工具",
      "猫咪很可爱",
      "hello",
      "hi"
    ],
  })

  console.log('\n🎯 相似度测试结果：');
  console.log('📏 数值范围：-1.0（完全相反）→ 0.0（无关）→ 1.0（完全相同）\n');

  console.log('🐱 猫 vs 🐶 狗（语义相近）:', cosineSimilarity(embeddings[0], embeddings[1]).toFixed(3));
  console.log('🐱 猫 vs 🚗 汽车（语义无关）:', cosineSimilarity(embeddings[0], embeddings[2]).toFixed(3));
  console.log('🐱 猫 vs 🐱 猫咪（语义相同）:', cosineSimilarity(embeddings[0], embeddings[3]).toFixed(3));
  console.log('👋 hello vs 👋 hi（打招呼）:', cosineSimilarity(embeddings[4], embeddings[5]).toFixed(3));
}

main()
