import {
  ProviderNotConfiguredError,
  askDatabase,
  buildCorrectionInterpretationPrompt,
  type LLMProvider
} from "@ask-database/core";
import type { AskRequest, CorrectionRequest, CorrectionResult, WorkspaceMemoryRule } from "@ask-database/shared";
import { correctionInterpretationSchema } from "@ask-database/core";
import { WorkspaceRepository } from "../repositories/workspace-repository.js";

export class AskService {
  constructor(
    private readonly repository: WorkspaceRepository,
    private readonly provider: LLMProvider
  ) {}

  async ask(request: AskRequest) {
    const workspace = await this.repository.get(request.workspaceId);
    if (!workspace) {
      return {
        status: 404 as const,
        body: { error: "Workspace nie istnieje." }
      };
    }

    try {
      const conversation =
        request.conversationId && (await this.repository.getConversation(request.conversationId))
          ? await this.repository.getConversation(request.conversationId)
          : await this.repository.createConversation(workspace.id, request.question.slice(0, 80));
      if (!conversation) {
        return {
          status: 500 as const,
          body: { error: "Nie udalo sie utworzyc konwersacji." }
        };
      }

      await this.repository.addTurn(conversation.id, "user", request.question);
      const turns = await this.repository.listTurns(conversation.id);
      const result = await askDatabase({
        workspace,
        request: {
          ...request,
          conversationId: conversation.id
        },
        provider: this.provider,
        conversationTurns: turns,
        createQueryVersion: (version) =>
          this.repository.createQueryVersion({
            workspaceId: workspace.id,
            conversationId: conversation.id,
            ...version
          })
      });
      await this.repository.addTurn(conversation.id, "assistant", result.interpretation);

      return {
        status: 200 as const,
        body: {
          conversation,
          result
        }
      };
    } catch (error) {
      if (error instanceof ProviderNotConfiguredError) {
        return {
          status: 503 as const,
          body: {
            error: "Provider generowania nie jest skonfigurowany.",
            code: "PROVIDER_NOT_CONFIGURED",
            setup: "Ustaw LLM_PROVIDER=openai oraz OPENAI_API_KEY po stronie backendu."
          }
        };
      }

      return {
        status: 500 as const,
        body: {
          error: "Generowanie SQL nie powiodlo sie.",
          code: "GENERATION_FAILED"
        }
      };
    }
  }

  async correct(
    workspaceId: string,
    conversationId: string,
    request: CorrectionRequest
  ): Promise<{ status: number; body: CorrectionResult | { error: string; code?: string } }> {
    const workspace = await this.repository.get(workspaceId);
    if (!workspace) {
      return { status: 404, body: { error: "Workspace nie istnieje." } };
    }
    const turns = await this.repository.listTurns(conversationId);
    const latestVersion = await this.repository.getLatestQueryVersion(conversationId);
    if (!latestVersion) {
      return {
        status: 404,
        body: {
          error: "Nie znaleziono wersji zapytania do skorygowania.",
          code: "QUERY_VERSION_NOT_FOUND"
        }
      };
    }
    const lastAssistant = [...turns].reverse().find((turn) => turn.role === "assistant");
    const previousSql = latestVersion.sql;

    try {
      const prompt = buildCorrectionInterpretationPrompt({
        correction: request.message,
        currentInterpretation: lastAssistant?.message ?? latestVersion.interpretation,
        currentSql: previousSql,
        schemaContext: workspace.schema,
        alternativePaths: workspace.schema.relationships
      });
      const correctionInterpretation = await this.provider.generateStructured({
        name: "correction_interpretation",
        schema: correctionInterpretationSchema,
        ...prompt
      });

      if (request.persistScope === "workspace" && correctionInterpretation.memoryProposal) {
        await this.repository.addMemoryRules(workspaceId, [
          correctionInterpretation.memoryProposal as WorkspaceMemoryRule
        ]);
      }

      await this.repository.addTurn(conversationId, "user", `Korekta: ${request.message}`);
      const correctedQuestion = `${latestVersion.question}\nKorekta użytkownika: ${request.message}`;
      const result = await askDatabase({
        workspace,
        provider: this.provider,
        conversationTurns: await this.repository.listTurns(conversationId),
        request: {
          workspaceId,
          question: correctedQuestion,
          dialect: workspace.dialect,
          safeMode: true,
          conversationId,
          previousQueryVersionId: latestVersion.id
        },
        createQueryVersion: (version) =>
          this.repository.createQueryVersion({
            workspaceId: workspace.id,
            conversationId,
            ...version
          })
      });
      await this.repository.addTurn(conversationId, "assistant", result.interpretation);

      return {
        status: 200,
        body: {
          correctionInterpretation,
          changesApplied: [
            ...correctionInterpretation.filterChanges,
            ...correctionInterpretation.meaningChanges
          ],
          previousSql,
          newSql: result.sql,
          validation: result.validation,
          ...(correctionInterpretation.memoryProposal
            ? { memoryProposal: correctionInterpretation.memoryProposal }
            : {}),
          result
        }
      };
    } catch (error) {
      if (error instanceof ProviderNotConfiguredError) {
        return {
          status: 503,
          body: {
            error: "Provider generowania nie jest skonfigurowany.",
            code: "PROVIDER_NOT_CONFIGURED"
          }
        };
      }
      return {
        status: 500,
        body: {
          error: "Nie udalo sie zinterpretowac korekty.",
          code: "CORRECTION_FAILED"
        }
      };
    }
  }
}
