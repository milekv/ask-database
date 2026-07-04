import { DisabledLLMProvider, type LLMProvider } from "@ask-database/core";
import { OpenAIProvider } from "./openai-provider.js";

export function createLLMProviderFromEnv(env = process.env): LLMProvider {
  const provider = (env.LLM_PROVIDER ?? "disabled").toLowerCase();

  if (provider === "openai") {
    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) {
      return new DisabledLLMProvider();
    }

    return new OpenAIProvider({
      apiKey,
      model: env.OPENAI_MODEL ?? "gpt-4.1-mini",
      timeoutMs: Number(env.OPENAI_TIMEOUT_MS ?? 45_000)
    });
  }

  return new DisabledLLMProvider();
}
