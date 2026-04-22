/**
 * 创建 OpenAI 兼容的大模型提供商实例
 * 支持阿里云等兼容 OpenAI API 的服务
 */
import { createOpenAI } from "@ai-sdk/openai"
import "./config"

/**
 * 创建 OpenAI 兼容的模型提供商
 * @returns OpenAI 模型提供商实例
 * @example
 * ```ts
 * import { openai } from "shared-utils"
 * const model = openai("qwen-turbo")
 * ```
 */
export default function () {
  return createOpenAI({
    apiKey: process.env.ALIBABA_API_KEY ?? "",
    baseURL: process.env.ALIBABA_BASE_URL ?? "",
  })
}
