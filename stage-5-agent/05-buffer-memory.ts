import { generateText, type LanguageModelUsage } from "ai"
import { qwen } from "shared-utils"
import readline from "readline"

/**
 * Buffer Memory — 完整保留对话历史
 *
 * 核心思路：
 * - 使用数组维护完整对话历史，每次调用 LLM 时传入全部消息
 * - 实现 token 估算，当接近上下文窗口上限时发出警告
 * - 利用 AI SDK 返回的 usage 数据精确追踪实际 token 用量
 *
 * Token 计数方案：
 * - 发送前：字符数粗略估算（约 2 字符 ≈ 1 token），用于预警
 * - 发送后：API 返回的 usage.promptTokens，精确值
 */

/** 模型的上下文窗口上限（tokens），qwen3-max 约 32K，按需调整 */
const CONTEXT_WINDOW_LIMIT = 32_000

/** token 用量警告阈值（80%） */
const WARN_THRESHOLD = 0.8

/** token 用量危险阈值（95%） */
const DANGER_THRESHOLD = 0.95

/** 每条消息的额外格式开销（role 标记 + 分隔符等），约 4 tokens */
const MESSAGE_OVERHEAD_TOKENS = 4

const model = qwen()

/** 系统提示词 */
const SYSTEM_PROMPT = "你是一个有帮助的 AI 助手，帮助用户回答问题。"

/** 对话历史（Buffer Memory 的核心数据结构） */
const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
  { role: "system", content: SYSTEM_PROMPT },
]

/** 累计 token 用量追踪（基于 API 返回的精确值） */
let totalTokensUsed = 0

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

/**
 * 粗略估算文本的 token 数
 * 经验值：中英混合场景约 2 字符 ≈ 1 token
 * 注意：这是估算值，实际值以 API 返回的 usage 为准
 *
 * @param text - 需要估算的文本
 * @returns 估算的 token 数量
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 2)
}

/**
 * 估算消息数组的 token 总数
 * 每条消息额外开销约 4 tokens（role 标记 + 格式分隔符）
 *
 * @param msgs - 消息数组
 * @returns 估算的 token 总数
 */
function estimateMessagesTokens(
  msgs: Array<{ role: string; content: string }>
): number {
  return msgs.reduce((sum, msg) => {
    return sum + estimateTokens(msg.content) + MESSAGE_OVERHEAD_TOKENS
  }, 0)
}

/**
 * 检查 token 用量并输出状态信息
 * - 绿色：用量 < 80%，安全
 * - 黄色警告：用量 >= 80%，建议压缩或截断
 * - 红色危险：用量 >= 95%，即将超出上下文窗口
 *
 * @param msgs - 消息数组
 * @returns 当前估算的 token 占比
 */
function checkTokenUsage(
  msgs: Array<{ role: string; content: string }>
): number {
  const estimated = estimateMessagesTokens(msgs)
  const percentage = estimated / CONTEXT_WINDOW_LIMIT
  const percentStr = `${(percentage * 100).toFixed(1)}%`

  if (percentage >= DANGER_THRESHOLD) {
    console.log(
      `\x1b[31m🚨 危险：对话历史约 ${estimated} tokens（${percentStr}），即将超出上下文窗口！\x1b[0m`
    )
    console.log(
      "\x1b[31m   API 调用可能失败，请立即压缩历史（Summary Memory）或截断（Window Memory）\x1b[0m"
    )
  } else if (percentage >= WARN_THRESHOLD) {
    console.log(
      `\x1b[33m⚠️  警告：对话历史约 ${estimated} tokens（${percentStr}），已接近上下文窗口上限\x1b[0m`
    )
    console.log(
      "\x1b[33m   建议压缩早期对话（Summary Memory）或截断（Window Memory）\x1b[0m"
    )
  } else {
    console.log(
      `\x1b[32m📊 Token 用量：${estimated} / ${CONTEXT_WINDOW_LIMIT}（${percentStr}）\x1b[0m`
    )
  }

  return percentage
}

/**
 * 格式化显示 API 返回的精确 token 用量
 *
 * @param usage - AI SDK 返回的 usage 对象（LanguageModelUsage）
 */
function logActualUsage(usage: LanguageModelUsage) {
  const inputTokens = usage.inputTokens ?? 0
  const outputTokens = usage.outputTokens ?? 0
  const total = usage.totalTokens ?? (inputTokens + outputTokens)
  console.log(
    `📊 API 实测：input ${inputTokens} + output ${outputTokens} = ${total} tokens`
  )
  totalTokensUsed += total
  console.log(`📈 累计消耗：${totalTokensUsed} tokens`)
}

/**
 * 交互式输入提示
 *
 * @param q - 提示文本
 * @returns 用户输入的字符串
 */
const question = (q: string) => {
  return new Promise<string>((resolve) => {
    rl.question(q, resolve)
  })
}

/**
 * 主循环：交互式多轮对话
 * 每轮对话前检查 token 用量预警，对话后输出精确用量
 */
async function main() {
  console.log("=== Buffer Memory 测试（含 Token 计数警告）===")
  console.log(`上下文窗口上限：${CONTEXT_WINDOW_LIMIT} tokens`)
  console.log(
    `警告阈值：${WARN_THRESHOLD * 100}% | 危险阈值：${DANGER_THRESHOLD * 100}%`
  )
  console.log('输入 "exit" 退出\n')

  while (true) {
    // 1. 发送前：检查 token 用量预警
    checkTokenUsage(messages)

    const message = await question("👤 你: ")
    if (message === "exit") {
      console.log("\n📋 对话统计：")
      console.log(
        `   总轮次：${Math.floor((messages.length - 1) / 2)}`
      )
      console.log(`   累计消耗：${totalTokensUsed} tokens`)
      process.exit()
    }

    // 2. 添加用户消息到历史
    messages.push({ role: "user", content: message })

    // 3. 调用 LLM（传入完整对话历史）
    const result = await generateText({
      model: model("qwen3-max"),
      messages,
    })

    // 4. 输出 AI 回复
    console.log(`\n🤖 助手: ${result.text}\n`)

    // 5. 输出精确 token 用量（基于 API 返回值）
    logActualUsage(result.usage)

    // 6. 添加 AI 回复到历史
    messages.push({ role: "assistant", content: result.text })

    // 7. 添加后再次检查（为下一轮提供预警）
    checkTokenUsage(messages)
    console.log("─".repeat(50))
  }
}

main()
