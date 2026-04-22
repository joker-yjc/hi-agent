import { createAlibaba } from "@ai-sdk/alibaba";
import "./config"

export default function () {
  return createAlibaba({
    apiKey: process.env.ALIBABA_API_KEY,
    baseURL: process.env.ALIBABA_BASE_URL,
  })
}
