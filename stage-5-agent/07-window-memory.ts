import { generateText, type LanguageModelUsage } from "ai"
import { qwen } from "shared-utils"
import readline from "readline"

/**
 * Window Memory — 滑动窗口记忆
 *
 * 核心思路：
 * - 只保留最近 K 轮对话（1 轮 = 1 条 user + 1 条 assistant）
 * - 当历史超过 K 轮时，丢弃最早的对话轮次
 * - system prompt 始终保留，不受窗口限制
 * - 优点：token 用量可控，不会超出上下文窗口
 * - 缺点：丢失早期信息，Agent 无法回忆窗口外的内容
 *
 * 对比 Buffer Memory：
 * - Buffer：保留全部历史，token 无上限，可能超出窗口
 * - Window：只保留最近 K 轮，token 可控，但丢失早期信息
 *
 * 对比实验（运行时可切换）：
 * - K=3：极省 token，但几乎无法回忆早期对话
 * - K=5：均衡，保留最近 5 轮上下文
 * - K=10：较多上下文，回忆能力更好，但 token 消耗更高
 */

/** 模型的上下文窗口上限（tokens），qwen3-max 约 32K */
const CONTEXT_WINDOW_LIMIT = 32_000

/** 每条消息的额外格式开销（role 标记 + 分隔符等），约 4 tokens */
const MESSAGE_OVERHEAD_TOKENS = 4

const model = qwen()

/** 系统提示词（始终保留，不受窗口截断影响） */
const SYSTEM_PROMPT =
  "你是一个有帮助的 AI 助手，帮助用户回答问题。请基于对话上下文回答，如果上下文中没有相关信息，请如实说明。"

/** 窗口大小：保留最近 K 轮对话（可通过命令调整） */
let windowSize = 5

/**
 * 对话历史（Window Memory 的核心数据结构）
 * 包含 system 消息 + 多轮 user/assistant 消息
 */
const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
  { role: "system", content: SYSTEM_PROMPT },
]

/** 已被窗口丢弃的总轮次 */
let droppedRounds = 0

/** 累计 token 用量追踪 */
let totalTokensUsed = 0

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

/**
 * 粗略估算文本的 token 数
 * 经验值：中英混合场景约 2 字符 ≈ 1 token
 *
 * @param text - 需要估算的文本
 * @returns 估算的 token 数量
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 2)
}

/**
 * 估算消息数组的 token 总数
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
 * 应用滑动窗口：只保留最近 K 轮对话
 * - system 消息始终保留
 * - 一轮对话 = 1 条 user + 1 条 assistant
 * - 超出窗口的最早轮次被丢弃
 *
 * @param windowK - 窗口大小（保留最近 K 轮）
 * @returns 被丢弃的消息数量
 */
function applyWindow(windowK: number): number {
  // 1. 分离 system 消息和对话消息
  const systemMsgs = messages.filter((m) => m.role === "system")
  const chatMsgs = messages.filter((m) => m.role !== "system")

  // 2. 计算当前轮次（每轮 = 1 user + 1 assistant = 2 条消息）
  const currentRounds = Math.floor(chatMsgs.length / 2)

  // 3. 如果没超过窗口，无需截断
  if (currentRounds <= windowK) {
    return 0
  }

  // 4. 计算需要丢弃的轮次和对应的消息条数
  const roundsToDrop = currentRounds - windowK
  const msgsToDrop = roundsToDrop * 2 // 每轮 2 条消息

  // 5. 截断：保留 system + 最后 windowK 轮的消息
  const remainingChatMsgs = chatMsgs.slice(msgsToDrop)
  const droppedCount = chatMsgs.length - remainingChatMsgs.length

  // 6. 更新 messages 数组
  messages.length = 0
  messages.push(...systemMsgs, ...remainingChatMsgs)

  // 7. 更新丢弃计数
  droppedRounds += roundsToDrop

  return droppedCount
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
}

/**
 * 显示当前窗口状态信息
 */
function showWindowStatus() {
  const chatMsgs = messages.filter((m) => m.role !== "system")
  const currentRounds = Math.floor(chatMsgs.length / 2)
  const estimated = estimateMessagesTokens(messages)
  const percentage = ((estimated / CONTEXT_WINDOW_LIMIT) * 100).toFixed(1)

  console.log(
    `🪟 窗口 [K=${windowSize}]：当前 ${currentRounds}/${windowSize} 轮 | ` +
    `已丢弃 ${droppedRounds} 轮 | ` +
    `约 ${estimated} tokens（${percentage}%）`
  )
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
 * 显示帮助信息
 */
function showHelp() {
  console.log(`
┌─────────────────────────────────────────────────┐
│  Window Memory 命令列表                          │
├─────────────────────────────────────────────────┤
│  /window K  — 调整窗口大小为 K（如 /window 3）   │
│  /status    — 查看当前窗口状态和 token 用量       │
│  /history   — 显示当前窗口内的对话历史            │
│  /help      — 显示此帮助信息                      │
│  exit       — 退出程序                            │
└─────────────────────────────────────────────────┘
  `)
}

/**
 * 显示当前窗口内的对话历史
 */
function showHistory() {
  console.log("\n📜 当前窗口内的对话历史：")
  console.log("─".repeat(40))
  for (const msg of messages) {
    if (msg.role === "system") {
      console.log(`[系统] ${msg.content.slice(0, 50)}...`)
    } else if (msg.role === "user") {
      console.log(`[用户] ${msg.content}`)
    } else {
      console.log(`[助手] ${msg.content.slice(0, 80)}${msg.content.length > 80 ? "..." : ""}`)
    }
  }
  console.log("─".repeat(40))
}

/**
 * 主循环：交互式多轮对话（带滑动窗口）
 */
async function main() {
  console.log("=== Window Memory 测试（滑动窗口记忆）===")
  console.log(`当前窗口大小：K = ${windowSize} 轮`)
  console.log(`上下文窗口上限：${CONTEXT_WINDOW_LIMIT} tokens`)
  console.log('输入 "/help" 查看命令列表，输入 "exit" 退出\n')

  showHelp()

  while (true) {
    // 1. 显示窗口状态
    showWindowStatus()

    const message = await question("👤 你: ")

    // 2. 处理特殊命令
    if (message === "exit") {
      console.log("\n📋 对话统计：")
      const chatMsgs = messages.filter((m) => m.role !== "system")
      console.log(`   窗口内轮次：${Math.floor(chatMsgs.length / 2)}`)
      console.log(`   累计丢弃轮次：${droppedRounds}`)
      console.log(`   累计消耗：${totalTokensUsed} tokens`)
      process.exit()
    }

    if (message === "/help") {
      showHelp()
      continue
    }

    if (message === "/status") {
      showWindowStatus()
      console.log(`📈 累计消耗：${totalTokensUsed} tokens`)
      continue
    }

    if (message === "/history") {
      showHistory()
      continue
    }

    // /window K — 调整窗口大小
    const windowMatch = message.match(/^\/window\s+(\d+)$/)
    if (windowMatch) {
      const newSize = parseInt(windowMatch[1], 10)
      if (newSize < 1) {
        console.log("❌ 窗口大小必须 >= 1")
        continue
      }
      if (newSize > 50) {
        console.log("⚠️  窗口大小超过 50 可能导致 token 消耗过大，已限制为 50")
        windowSize = 50
      } else {
        windowSize = newSize
      }
      console.log(`\n🪟 窗口大小已调整为 K = ${windowSize}`)

      // 调整窗口后立即应用截断
      const dropped = applyWindow(windowSize)
      if (dropped > 0) {
        console.log(
          `\x1b[33m🗑️  缩小窗口：丢弃了 ${dropped} 条早期消息\x1b[0m`
        )
      }
      continue
    }

    // 3. 添加用户消息到历史
    messages.push({ role: "user", content: message })

    // 4. 调用 LLM（传入窗口内的对话历史）
    const result = await generateText({
      model: model("qwen3-max"),
      messages,
    })

    // 5. 输出 AI 回复
    console.log(`\n🤖 助手: ${result.text}\n`)

    // 6. 添加 AI 回复到历史
    messages.push({ role: "assistant", content: result.text })

    // 7. 应用滑动窗口（超过 K 轮时丢弃最早的对话）
    const dropped = applyWindow(windowSize)
    if (dropped > 0) {
      console.log(
        `\x1b[33m🗑️  窗口已满：丢弃了 ${dropped} 条早期消息（已累计丢弃 ${droppedRounds} 轮）\x1b[0m`
      )
    }

    // 8. 输出精确 token 用量
    logActualUsage(result.usage)

    console.log("─".repeat(50))
  }
}

main()
