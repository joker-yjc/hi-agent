/**
 * Vector Memory Store — 向量记忆公共存储模块
 *
 * 提供 JSON 文件持久化的向量记忆存储能力，供 08/09 脚本共用：
 * - cosineSimilarity：余弦相似度计算（由 AI SDK 提供）
 * - loadMemories / saveMemories：JSON 文件读写
 * - addMemory：添加记忆（带去重）
 * - searchMemories：向量相似度搜索
 * - createEmbeddingModel：创建 Embedding 模型实例
 * - shouldExtract：规则预过滤，避免每轮都调 LLM 提取记忆
 * - isExplicitTrigger：显式触发词检测（"记住xxx" → 命中后统一走 LLM 提取）
 * - isSuspiciousInput：注入攻击检测，过滤可疑的用户输入
 */

import { embed, cosineSimilarity } from "ai"
import type { EmbeddingModel } from "ai"
import * as fs from "fs"
import * as path from "path"

// ==================== 类型定义 ====================

/** 单条记忆的数据结构 */
export interface MemoryRecord {
  /** 记忆文本内容 */
  content: string
  /** 向量数据（由 Embedding 模型生成） */
  embedding: number[]
  /** 创建时间戳 */
  createdAt: number
}

/** 记忆存储文件的数据结构 */
export interface MemoryStore {
  /** 所有记忆记录 */
  memories: MemoryRecord[]
  /** 最后更新时间 */
  updatedAt: number
}

/** 搜索结果条目 */
export interface SearchResult {
  /** 记忆文本内容 */
  content: string
  /** 与查询的余弦相似度 */
  similarity: number
  /** 记忆创建时间戳 */
  createdAt: number
}

/** addMemory 的返回类型 */
export interface AddMemoryResult {
  /** true 表示新增，false 表示更新已有记忆 */
  isNew: boolean
  /** 记忆存储对象（已更新） */
  store: MemoryStore
}

// ==================== 注入攻击防护 ====================

/**
 * 记忆注入攻击模式
 *
 * ⚠️ 只拦截"伪造数据注入"类攻击（假装是记忆、伪造历史对话）
 * 不要拦截用户的显式触发词（如"记住xxx"），那是合法的记忆请求
 * 合法性判断由提取 Prompt 的安全规则负责，不在这里做
 */
const INJECTION_PATTERNS = [
  /这是相关的?记忆[：:]/i,   // 伪造记忆注入
  /以下是历史/i,             // 伪造历史对话
  /你之前答应过/i,           // 伪造承诺
  /以下是.*记忆/i,           // 伪造记忆列表
  /system:?\s/i,             // 伪装 system 消息
  /\[记忆\]|<记忆>/i,        // 伪装记忆标签
]

/**
 * 检测用户输入是否包含可疑的记忆注入模式
 *
 * 注意：此函数只检测"伪造数据注入"类攻击，不拦截显式触发词
 * 合法场景如"记住我喜欢TS"不会被拦截
 *
 * @param text - 用户输入文本
 * @returns true 表示输入可疑，应跳过提取
 */
export function isSuspiciousInput(text: string): boolean {
  return INJECTION_PATTERNS.some((p) => p.test(text))
}

// ==================== 记忆提取预过滤 ====================

/** 问候/感谢类消息的正则模式 */
const SKIP_PATTERNS =
  /^(你好|谢谢|好的|嗯|hi|hello|thanks|ok|再见|拜拜)[\s!！.。]*$/i

/** 最小提取长度阈值 */
const MIN_EXTRACT_LENGTH = 8

/** 显式触发词模式（只检测是否包含触发词，不提取内容） */
const EXPLICIT_TRIGGER_PATTERNS = [
  /^(?:记住|记得|别忘了)/,
  /^(?:remember|save)\b/i,
]

/**
 * 检测用户消息是否包含显式记忆触发词
 *
 * 当用户说"记住我喜欢TypeScript"时返回 true，
 * 但不提取内容——内容统一由 LLM 提取，保证记忆格式一致
 *
 * @param userMessage - 用户消息文本
 * @returns true 表示是显式触发，false 表示不是
 */
export function isExplicitTrigger(userMessage: string): boolean {
  const trimmed = userMessage.trim()
  return EXPLICIT_TRIGGER_PATTERNS.some((p) => p.test(trimmed))
}

/**
 * 判断消息是否值得交给 LLM 做自动提取
 *
 * 规则预过滤：避免每轮对话都调用 LLM，过滤掉明显不值得提取的消息
 * 注意：显式触发词由 isExplicitTrigger 单独检测，不走此过滤
 *
 * @param userMessage - 用户消息文本
 * @returns true 表示值得提取，false 表示应跳过
 */
export function shouldExtract(userMessage: string): boolean {
  const trimmed = userMessage.trim()

  // 太短的消息不值得提取
  if (trimmed.length < MIN_EXTRACT_LENGTH) return false
  // 问候/感谢类消息跳过
  if (SKIP_PATTERNS.test(trimmed)) return false
  return true
}

// ==================== 文件持久化 ====================

/**
 * 从 JSON 文件加载记忆
 * 如果文件不存在，返回空存储
 *
 * @param filePath - 记忆文件路径
 * @returns 记忆存储对象
 */
export function loadMemories(filePath: string): MemoryStore {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8")
      const store = JSON.parse(data) as MemoryStore
      console.log(`📂 已从文件加载 ${store.memories.length} 条记忆`)
      return store
    }
    console.log("📂 记忆文件不存在，从空存储开始")
  } catch (error) {
    console.error("❌ 加载记忆文件失败，使用空存储:", error)
  }
  return { memories: [], updatedAt: Date.now() }
}

/**
 * 将记忆保存到 JSON 文件
 *
 * @param store - 记忆存储对象
 * @param filePath - 记忆文件路径
 */
export function saveMemories(store: MemoryStore, filePath: string): void {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  store.updatedAt = Date.now()
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2), "utf-8")
}

// ==================== 记忆操作 ====================

/**
 * 添加记忆（带去重）
 * 1. 用 Embedding 模型将文本转为向量
 * 2. 搜索已有记忆，如果相似度 > dedupThreshold 则更新而非新增
 * 3. 持久化到 JSON 文件
 *
 * @param content - 记忆文本内容
 * @param store - 记忆存储对象
 * @param embeddingModel - Embedding 模型实例
 * @param filePath - 记忆文件路径
 * @param dedupThreshold - 去重阈值，默认 0.9
 * @returns 新增/更新结果
 */
export async function addMemory(
  content: string,
  store: MemoryStore,
  embeddingModel: EmbeddingModel,
  filePath: string,
  dedupThreshold: number = 0.9
): Promise<AddMemoryResult> {
  console.log("⏳ 正在生成向量嵌入...")

  const { embedding } = await embed({
    model: embeddingModel,
    value: content,
  })

  // 去重检查：搜索已有记忆，如果相似度 > 阈值则更新
  if (store.memories.length > 0) {
    const similarities = store.memories.map((record, index) => ({
      index,
      similarity: cosineSimilarity(embedding, record.embedding),
    }))
    const bestMatch = similarities.reduce((a, b) =>
      a.similarity > b.similarity ? a : b
    )

    if (bestMatch.similarity > dedupThreshold) {
      const existing = store.memories[bestMatch.index]
      console.log(
        `🔄 检测到相似记忆（相似度 ${bestMatch.similarity.toFixed(4)}），更新而非新增`
      )
      console.log(`   旧: ${existing.content}`)
      console.log(`   新: ${content}`)
      store.memories[bestMatch.index] = {
        content,
        embedding,
        createdAt: existing.createdAt,
      }
      saveMemories(store, filePath)
      console.log(`✅ 记忆已更新（共 ${store.memories.length} 条记忆）`)
      return { isNew: false, store }
    }
  }

  // 无相似记忆 → 新增
  const record: MemoryRecord = {
    content,
    embedding,
    createdAt: Date.now(),
  }
  store.memories.push(record)
  saveMemories(store, filePath)
  console.log(`✅ 记忆已添加并持久化（共 ${store.memories.length} 条记忆）`)
  return { isNew: true, store }
}

/**
 * 搜索记忆
 * 1. 将查询文本转为向量
 * 2. 与所有记忆计算余弦相似度
 * 3. 按相似度降序排列，返回 Top-K
 *
 * @param query - 查询文本
 * @param topK - 返回前 K 条最相似的记忆
 * @param store - 记忆存储对象
 * @param embeddingModel - Embedding 模型实例
 * @returns 相似记忆列表，按相似度降序排列
 */
export async function searchMemories(
  query: string,
  topK: number,
  store: MemoryStore,
  embeddingModel: EmbeddingModel
): Promise<SearchResult[]> {
  if (store.memories.length === 0) {
    console.log("⚠️  没有任何记忆可搜索")
    return []
  }

  console.log("⏳ 正在生成查询向量...")

  const { embedding: queryEmbedding } = await embed({
    model: embeddingModel,
    value: query,
  })

  const results: SearchResult[] = store.memories.map((record) => ({
    content: record.content,
    similarity: cosineSimilarity(queryEmbedding, record.embedding),
    createdAt: record.createdAt,
  }))

  return results.sort((a, b) => b.similarity - a.similarity).slice(0, topK)
}

/**
 * 列出所有记忆内容
 *
 * @param store - 记忆存储对象
 */
export function listMemories(store: MemoryStore): void {
  if (store.memories.length === 0) {
    console.log("📭 暂无记忆")
    return
  }
  console.log(`\n📋 共 ${store.memories.length} 条记忆：`)
  console.log("─".repeat(60))
  store.memories.forEach((m, i) => {
    const time = new Date(m.createdAt).toLocaleString("zh-CN")
    console.log(`  ${i + 1}. [${time}] ${m.content}`)
  })
  console.log("─".repeat(60))
}
