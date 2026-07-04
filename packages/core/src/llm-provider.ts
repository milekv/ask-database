import type { z } from "zod";

export interface StructuredGenerationRequest<T> {
  name: string;
  schema: z.ZodType<T>;
  system: string;
  user: string;
  timeoutMs?: number;
}

export interface LLMProviderHealth {
  ok: boolean;
  label: string;
  message: string;
}

export interface LLMProvider {
  readonly name: "disabled" | "openai" | "mock";
  generateStructured<T>(request: StructuredGenerationRequest<T>): Promise<T>;
  generateText(prompt: string): Promise<string>;
  healthCheck(): Promise<LLMProviderHealth>;
}

export class ProviderNotConfiguredError extends Error {
  constructor() {
    super("Provider generowania nie jest skonfigurowany.");
    this.name = "ProviderNotConfiguredError";
  }
}

export class DisabledLLMProvider implements LLMProvider {
  readonly name = "disabled" as const;

  async generateStructured<T>(): Promise<T> {
    throw new ProviderNotConfiguredError();
  }

  async generateText(): Promise<string> {
    throw new ProviderNotConfiguredError();
  }

  async healthCheck(): Promise<LLMProviderHealth> {
    return {
      ok: false,
      label: "Provider generowania nie jest skonfigurowany",
      message:
        "Ustaw LLM_PROVIDER=openai oraz OPENAI_API_KEY po stronie backendu. Frontend nie przechowuje kluczy."
    };
  }
}

export class MockLLMProvider implements LLMProvider {
  readonly name = "mock" as const;
  private structuredQueue: unknown[] = [];
  private textQueue: string[] = [];

  queueStructured(value: unknown): void {
    this.structuredQueue.push(value);
  }

  queueText(value: string): void {
    this.textQueue.push(value);
  }

  async generateStructured<T>(request: StructuredGenerationRequest<T>): Promise<T> {
    const value = this.structuredQueue.shift();
    if (value === undefined) {
      throw new Error(`MockLLMProvider has no queued structured response for ${request.name}.`);
    }

    return request.schema.parse(value);
  }

  async generateText(): Promise<string> {
    const value = this.textQueue.shift();
    if (value === undefined) {
      throw new Error("MockLLMProvider has no queued text response.");
    }

    return value;
  }

  async healthCheck(): Promise<LLMProviderHealth> {
    return {
      ok: true,
      label: "Mock provider",
      message: "Provider testowy z jawnie kolejkowanymi odpowiedziami strukturalnymi."
    };
  }
}
