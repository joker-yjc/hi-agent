/**
 * Summary Memory 实现
 * 
 * 核心机制：
 * 1. 维护完整对话历史
 * 2. 当对话轮数超过阈值时，触发摘要生成
 * 3. 用 LLM 将早期对话压缩为关键信息摘要
 * 4. 摘要作为 System Prompt 的一部分注入后续对话
 * 5. 保留最近 N 轮完整对话，更早的用摘要代替
 */

import { generateText, type ModelMessage } from 'ai';
import { openai } from 'shared-utils';
import * as readline from 'readline';

// 创建 OpenAI 兼容模型提供商实例
const model = openai();

// ==================== 配置参数 ====================

/** 触发摘要的对话轮数阈值 */
const SUMMARY_THRESHOLD = 5;
/** 保留的最近完整对话轮数 */
const KEEP_RECENT_ROUNDS = 3;

// ==================== 类型定义 ====================

interface SummaryMemory {
  /** 历史摘要内容 */
  summary: string;
  /** 完整对话历史（用于生成摘要） */
  fullHistory: ModelMessage[];
  /** 实际传给 LLM 的消息（摘要 + 最近对话） */
  messagesForLLM: ModelMessage[];
}

// ==================== 核心类 ====================

class SummaryMemoryManager {
  private summary = '';
  private fullHistory: ModelMessage[] = [];
  private messagesForLLM: ModelMessage[] = [];

  /**
   * 添加用户消息并获取用于 LLM 的消息列表
   */
  async addUserMessage(content: string): Promise<ModelMessage[]> {
    // 1. 添加到完整历史
    this.fullHistory.push({ role: 'user', content });

    // 2. 检查是否需要生成摘要
    await this.checkAndGenerateSummary();

    // 3. 构建传给 LLM 的消息列表
    this.buildMessagesForLLM();

    return this.messagesForLLM;
  }

  /**
   * 添加助手消息到历史
   */
  addAssistantMessage(content: string): void {
    this.fullHistory.push({ role: 'assistant', content });
    // 重新构建消息列表（包含最新的助手回复）
    this.buildMessagesForLLM();
  }

  /**
   * 检查是否需要生成摘要
   */
  private async checkAndGenerateSummary(): Promise<void> {
    // 计算当前对话轮数（user + assistant 算一轮）
    const currentRounds = Math.floor(this.fullHistory.length / 2);

    // 如果未达到阈值，不生成摘要
    if (currentRounds <= SUMMARY_THRESHOLD) {
      console.log(`[SummaryMemory] 当前 ${currentRounds} 轮，未达阈值 ${SUMMARY_THRESHOLD}，不生成摘要`);
      return;
    }

    // 已经生成过摘要且历史没变化，不重复生成
    if (this.summary && this.fullHistory.length === this.lastSummaryLength) {
      return;
    }

    console.log(`[SummaryMemory] 触发摘要生成，当前 ${currentRounds} 轮对话`);

    // 生成摘要
    await this.generateSummary();
  }

  private lastSummaryLength = 0;

  /**
   * 调用 LLM 生成摘要
   */
  private async generateSummary(): Promise<void> {
    try {
      // 将历史对话转为文本格式
      const historyText = this.fullHistory
        .map(msg => `${msg.role === 'user' ? '用户' : '助手'}: ${msg.content}`)
        .join('\n\n');

      const prompt = `请总结以下对话的关键信息，保留重要的用户偏好、事实和上下文。用简洁的语言概括主要内容：

${historyText}`;

      const result = await generateText({
        model: model('qwen3-max'),
        prompt,
        temperature: 0.3, // 低温度确保摘要稳定
      });

      this.summary = result.text;
      this.lastSummaryLength = this.fullHistory.length;

      console.log('[SummaryMemory] 摘要生成完成');
      console.log('[SummaryMemory] 摘要内容:', this.summary.substring(0, 200) + '...');
    } catch (error) {
      console.error('[SummaryMemory] 生成摘要失败:', error);
      // 失败时不阻断对话，继续使用空摘要
      this.summary = '';
    }
  }

  /**
   * 构建传给 LLM 的消息列表
   * 结构：[System(含摘要)] + [最近完整对话]
   */
  private buildMessagesForLLM(): void {
    const messages: ModelMessage[] = [];

    // 1. 添加 System Prompt（包含摘要）
    let systemContent = '你是一个 helpful 的 AI 助手。';
    if (this.summary) {
      systemContent += `\n\n【历史对话摘要】之前的对话中：${this.summary}\n请结合以上背景信息回答用户问题。`;
    }
    messages.push({ role: 'system', content: systemContent });

    // 2. 添加最近的完整对话
    // 保留最近 KEEP_RECENT_ROUNDS 轮（每轮 = user + assistant）
    const recentMessages = this.fullHistory.slice(-KEEP_RECENT_ROUNDS * 2);
    messages.push(...recentMessages);

    this.messagesForLLM = messages;
  }

  /**
   * 获取当前状态（用于调试）
   */
  getStatus(): { summary: string; historyLength: number; messagesCount: number } {
    return {
      summary: this.summary,
      historyLength: this.fullHistory.length,
      messagesCount: this.messagesForLLM.length,
    };
  }
}

// ==================== 交互式对话 ====================

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const memory = new SummaryMemoryManager();

  console.log('🤖 Summary Memory 测试');
  console.log(`配置：超过 ${SUMMARY_THRESHOLD} 轮触发摘要，保留最近 ${KEEP_RECENT_ROUNDS} 轮完整对话`);
  console.log('请输入消息开始对话（输入 "quit" 退出，输入 "status" 查看状态）：\n');

  const askQuestion = () => {
    rl.question('你: ', async (input) => {
      if (input.toLowerCase() === 'quit') {
        rl.close();
        return;
      }

      if (input.toLowerCase() === 'status') {
        const status = memory.getStatus();
        console.log('\n📊 当前状态：');
        console.log(`  - 摘要内容: ${status.summary || '(无)'}`);
        console.log(`  - 完整历史: ${status.historyLength} 条消息`);
        console.log(`  - 传给 LLM: ${status.messagesCount} 条消息\n`);
        askQuestion();
        return;
      }

      try {
        // 添加用户消息，获取用于 LLM 的消息列表（包含摘要）
        const messagesForLLM = await memory.addUserMessage(input);
        console.log(`\n[Debug] 传给 LLM 的消息数: ${messagesForLLM.length}`);
        if (messagesForLLM[0]?.role === 'system') {
          const systemContent = messagesForLLM[0].content as string;
          console.log(`[Debug] System 长度: ${systemContent.length} 字符`);
          if (systemContent.includes('【历史对话摘要】')) {
            const summaryMatch = systemContent.match(/【历史对话摘要】之前的对话中：(.+?)\n/);
            if (summaryMatch) {
              console.log(`[Debug] 摘要内容: ${summaryMatch[1].substring(0, 100)}...`);
            }
          }
        }

        // 调用 LLM
        const result = await generateText({
          model: model('gpt-4o-mini'),
          messages: messagesForLLM,
        });

        const response = result.text;
        console.log(`\nAI: ${response}\n`);

        // 将助手回复添加到历史
        memory.addAssistantMessage(response);
      } catch (error) {
        console.error('错误:', error);
      }

      askQuestion();
    });
  };

  askQuestion();
}

main().catch(console.error);
