import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const baseURL = (process.env.OPENCODE_AI_ENDPOINT || "https://opencode.ai/zen/go/v1/chat/completions").replace(
  /\/chat\/completions$/,
  ""
);

export const provider = createOpenAICompatible({
  name: "opencode-ai",
  apiKey: process.env.OPENCODE_AI_API_KEY,
  baseURL,
});

export const model = provider(process.env.OPENCODE_AI_MODEL || "deepseek-v4-flash");

export const modelPro = provider(process.env.OPENCODE_AI_MODEL_PRO || "deepseek-v4-pro");
