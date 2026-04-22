import { createDeepSeek } from '@ai-sdk/deepseek';
import "./config"

const deepseek = () => createDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY ?? '',
});

export default deepseek;
