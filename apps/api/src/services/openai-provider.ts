import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { LLMProvider, LLMProviderHealth, StructuredGenerationRequest } from "@ask-database/core";

export interface OpenAIProviderConfig {
  apiKey: string;
  model: string;
  timeoutMs: number;
}

export class OpenAIProvider implements LLMProvider {
  readonly name = "openai" as const;
  private readonly client: OpenAI;

  constructor(private readonly config: OpenAIProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      timeout: config.timeoutMs
    });
  }

  async generateStructured<T>(request: StructuredGenerationRequest<T>): Promise<T> {
    const response = await this.client.responses.parse({
      model: this.config.model,
      input: [
        {
          role: "system",
          content: request.system
        },
        {
          role: "user",
          content: request.user
        }
      ],
      text: {
        format: zodTextFormat(request.schema, request.name)
      }
    });

    const parsed = response.output_parsed;
    if (!parsed) {
      throw new Error("OpenAI response did not contain parsed structured output.");
    }

    return request.schema.parse(parsed);
  }

  async generateText(prompt: string): Promise<string> {
    const response = await this.client.responses.create({
      model: this.config.model,
      input: prompt
    });

    return response.output_text;
  }

  async healthCheck(): Promise<LLMProviderHealth> {
    return {
      ok: true,
      label: "OpenAI Responses API",
      message: `Provider skonfigurowany. Model: ${this.config.model}.`
    };
  }
}
