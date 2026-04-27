/**
 * 08-vector-memory.ts — 向量长期记忆
 *
 * Day 17 学习目标：
 * 1. 用 Embedding 将重要信息存入向量存储 ✅
 * 2. 新对话开始时，根据用户输入检索相关记忆 ✅
 * 3. 将检索到的记忆注入 System Prompt ✅
 * 4. 实现记忆的自动提取：从对话中识别值得记住的信息 ✅
 *
 * 公共方法来自 memory-store.ts：
 * - addMemory / searchMemories / loadMemories / saveMemories 
 */

import { generateText, embed } from "ai"
import { qwen, openai } from "shared-utils"
import * as path from "path"
import {
  addMemory,
  searchMemories,
  loadMemories,
  listMemories,
  type MemoryStore,
} from "./memory-store"

// ==================== 配置 ====================

/** 记忆存储文件路径 */
const MEMORY_FILE = path.join(__dirname, "data", "vector-memories.json")

/** 对话模型 */
const chatModel = qwen()

/** Embedding 模型 */
const embeddingModel = openai().embedding("text-embedding-v3")

// ==================== 核心功能 ====================

/**
 * 将检索到的记忆注入 System Prompt
 * 根据用户输入搜索相关记忆，拼接到系统提示词中
 *
 * @param userInput - 用户输入
 * @param store - 记忆存储对象
 * @returns 包含相关记忆的 System Prompt
 */
async function buildSystemPromptWithMemory(
  userInput: string,
  store: MemoryStore
): Promise<string> {
  const basePrompt = "你是一个有帮助的 AI 助手，帮助用户回答问题。"

  // 如果没有记忆，返回基础提示词
  if (store.memories.length === 0) {
    return basePrompt
  }

  // 搜索与用户输入相关的记忆
  const results = await searchMemories(userInput, 3, store, embeddingModel)

  // 过滤低相似度结果（< 0.4 视为无关）
  const relevant = results.filter((r) => r.similarity > 0.4)

  if (relevant.length === 0) {
    console.log("💭 没有找到相关记忆，使用基础提示词")
    return basePrompt
  }

  console.log("💭 找到相关记忆，注入 System Prompt：")
  relevant.forEach((r, i) => {
    console.log(`   ${i + 1}. [${r.similarity.toFixed(4)}] ${r.content}`)
  })

  const memoryContext = relevant.map((r) => `- ${r.content}`).join("\n")

  return `${basePrompt}

【相关记忆】以下是之前对话中记住的信息，请结合这些背景回答用户问题：
${memoryContext}`
}

/**
 * 从对话中自动提取值得记住的信息
 * 让 LLM 判断当前对话中是否有值得长期记住的内容
 *
 * @param userMessage - 用户消息
 * @param assistantMessage - 助手回复
 * @param store - 记忆存储对象
 * @returns 提取到的记忆内容列表（空数组表示无需记忆）
 */
async function extractMemories(
  userMessage: string,
  assistantMessage: string,
  store: MemoryStore
): Promise<string[]> {
  const { text } = await generateText({
    model: chatModel("qwen3-max"),
    system: `你是一个记忆提取助手。分析用户和助手的对话，提取值得长期记住的信息。

提取规则：
1. 只提取"事实性"信息（用户偏好、个人信息、项目事实等）
2. 忽略闲聊、问候、简单问答
3. 每条记忆用一个简洁的句子表达
4. 如果没有值得记住的信息，返回空 JSON 数组
5. 必须以 JSON 数组格式返回，例如：["记忆1", "记忆2"]`,
    prompt: `用户: ${userMessage}\n助手: ${assistantMessage}\n\n请提取值得长期记住的信息：`,
  })

  try {
    // 尝试从回复中解析 JSON 数组
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return []

    const memories = JSON.parse(jsonMatch[0]) as string[]
    if (!Array.isArray(memories)) return []

    // 过滤空字符串
    return memories.filter((m) => typeof m === "string" && m.trim().length > 0)
  } catch {
    console.log("⚠️  记忆提取结果解析失败，跳过自动记忆")
    return []
  }
}

// ==================== 测试主流程 ====================

/**
 * 测试完整流程：
 * 1. 添加记忆 → 2. 检索注入 System Prompt → 3. 自动提取记忆
 */
async function main() {
  console.log("=== 08-Vector Memory 测试（向量记忆 + 检索注入 + 自动提取）===\n")

  // ---- 第一步：添加初始记忆 ----
  console.log("📝 第一步：添加初始记忆")
  const store = loadMemories(MEMORY_FILE)
  await addMemory("我喜欢用 TypeScript 写代码", store, embeddingModel, MEMORY_FILE)
  await addMemory(
    "项目名称是 hi-agent，一个 AI 学习项目",
    store,
    embeddingModel,
    MEMORY_FILE
  )
  await addMemory(
    "用户偏好使用 pnpm 作为包管理器",
    store,
    embeddingModel,
    MEMORY_FILE
  )
  console.log()

  // ---- 第二步：检索记忆注入 System Prompt ----
  console.log("🔍 第二步：检索记忆注入 System Prompt")
  const userQuery = "这个项目用什么语言开发？"
  console.log(`   用户提问：「${userQuery}」`)

  const systemPrompt = await buildSystemPromptWithMemory(userQuery, store)
  console.log(`\n   生成的 System Prompt：`)
  console.log("─".repeat(50))
  console.log(systemPrompt)
  console.log("─".repeat(50))

  // 用注入了记忆的 System Prompt 调用 LLM
  console.log("\n   LLM 回复：")
  const result = await generateText({
    model: chatModel("qwen3-max"),
    system: systemPrompt,
    prompt: userQuery,
  })
  console.log(`   ${result.text}\n`)

  // ---- 第三步：自动提取记忆 ----
  console.log("🧠 第三步：自动提取记忆")
  const testUser = "我叫小明，我正在学习 AI 开发，用的是 Mac 电脑"
  const testAssistant = "你好小明！Mac 上开发 AI 很方便，有什么我可以帮你的吗？"
  console.log(`   对话：`)
  console.log(`   用户: ${testUser}`)
  console.log(`   助手: ${testAssistant}`)

  const extracted = await extractMemories(testUser, testAssistant, store)
  if (extracted.length > 0) {
    console.log(`\n   提取到 ${extracted.length} 条记忆：`)
    for (const mem of extracted) {
      console.log(`   - ${mem}`)
      await addMemory(mem, store, embeddingModel, MEMORY_FILE)
    }
  } else {
    console.log("   没有提取到值得记住的信息")
  }
  console.log()

  // ---- 验证最终记忆状态 ----
  console.log("📋 最终记忆状态：")
  listMemories(store)

  console.log("\n✅ 向量记忆完整流程验证完成")
}

main().catch(console.error)
