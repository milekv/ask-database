import type { GenerationResult, Workspace } from "@ask-database/shared";

export interface StructuredGenerationInput {
  workspace: Workspace;
  question: string;
  safeMode: boolean;
}

export interface LLMProviderHealth {
  ok: boolean;
  label: string;
  message: string;
}

export interface LLMProvider {
  readonly name: string;
  generateStructured(input: StructuredGenerationInput): Promise<GenerationResult>;
  generateText(prompt: string): Promise<string>;
  healthCheck(): Promise<LLMProviderHealth>;
}

export class DisabledLLMProvider implements LLMProvider {
  readonly name = "disabled";

  async generateStructured(): Promise<GenerationResult> {
    throw new Error("Provider LLM nie jest skonfigurowany.");
  }

  async generateText(): Promise<string> {
    throw new Error("Provider LLM nie jest skonfigurowany.");
  }

  async healthCheck(): Promise<LLMProviderHealth> {
    return {
      ok: false,
      label: "LLM wylaczony",
      message: "ASK DATABASE moze dzialac w trybie demo bez wysylania danych do providera."
    };
  }
}
