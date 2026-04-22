import { tool } from 'ai';
import { z } from 'zod';

/**
 * 文本摘要工具
 * 对长文本进行摘要，提取核心要点
 * 注：此工具使用"提取式摘要"算法（取前 N 句），不是真正的语义生成式摘要
 */

export const summarize = tool({
  description: '对长文本进行摘要，提取核心要点。输入文本和期望的摘要长度，返回精简后的内容。适合处理网页抓取后的长文章内容。注：这是基于句子抽取的简单摘要，不是 AI 生成式摘要。',
  inputSchema: z.object({
    text: z.string().describe('需要摘要的长文本'),
    maxSentences: z.number().optional().describe('摘要的最大句子数，默认 5 句'),
  }),
  execute: async ({ text, maxSentences = 5 }) => {
    console.log(`[工具调用] summarize: 文本长度 ${text.length} 字符`);

    if (text.length < 200) {
      return {
        originalLength: text.length,
        summary: text,
        note: '原文较短，无需摘要',
      };
    }

    const sentences = splitIntoSentences(text);

    if (sentences.length <= maxSentences) {
      return {
        originalLength: text.length,
        summary: text,
        note: '原文句子数较少，直接返回全文',
      };
    }

    const summary = sentences.slice(0, maxSentences).join(' ');

    if (summary.length > text.length * 0.7) {
      return {
        originalLength: text.length,
        summary: text,
        note: '摘要与原文差异不大，直接返回原文',
      };
    }

    return {
      originalLength: text.length,
      summaryLength: summary.length,
      sentencesExtracted: Math.min(sentences.length, maxSentences),
      compressionRatio: ((1 - summary.length / text.length) * 100).toFixed(1) + '%',
      summary,
    };
  },
});

/**
 * 将文本分割成句子
 * 支持中英文标点：. ! ? 。！？以及中文省略号……和英文省略号...
 */
function splitIntoSentences(text: string): string[] {
  return text
    .replace(/([.!?。！？])\s+/g, '$1\n')
    .replace(/。{3,}/g, '……\n')
    .replace(/\.{3,}/g, '...\n')
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 10);
}