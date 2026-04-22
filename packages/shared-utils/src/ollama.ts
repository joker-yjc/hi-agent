import { createOllama } from 'ollama-ai-provider-v2';
import "./config"

const ollama = () => createOllama({
  // optional settings, e.g.
  baseURL: process.env.OLLAMA_BASE_URL
});

export default ollama;
