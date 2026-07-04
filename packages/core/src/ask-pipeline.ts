import type {
  AskRequest,
  DecisionLogEntry,
  GenerationEvidence,
  GenerationResult,
  QueryTurn,
  QueryVersion,
  ValidationResult,
  Workspace
} from "@ask-database/shared";
import { validateGeneratedSql } from "@ask-database/sql-validator";
import type { LLMProvider } from "./llm-provider.js";
import { buildControlledRegenerationPrompt } from "./prompts/controlled-regeneration.prompt.js";
import { buildQuestionInterpretationPrompt } from "./prompts/question-interpretation.prompt.js";
import {
  generatedSqlDraftSchema,
  questionInterpretationSchema,
  type GeneratedSqlDraft,
  type QuestionInterpretation
} from "./prompts/schemas.js";
import { buildSqlGenerationPrompt } from "./prompts/sql-generation.prompt.js";
import { retrieveHistoricalQueries } from "./retrieval/historical-query-retriever.js";
import { rankRelationshipPaths } from "./retrieval/relationship-path-ranker.js";
import { retrieveWorkspaceContext } from "./retrieval/workspace-retriever.js";

const MAX_CONTROLLED_REGENERATION_ATTEMPTS = 2;

export interface AskDatabaseInput {
  workspace: Workspace;
  request: AskRequest;
  provider: LLMProvider;
  conversationTurns?: QueryTurn[];
  createQueryVersion?: (result: {
    question: string;
    interpretation: string;
    sql: string;
    validation: ValidationResult;
    metadata: Record<string, unknown>;
  }) => Promise<QueryVersion>;
}

export async function askDatabase(input: AskDatabaseInput): Promise<GenerationResult> {
  const decisionLog: DecisionLogEntry[] = [];
  const question = input.request.question.trim();
  addDecision(decisionLog, "validate_workspace", `Workspace ${input.workspace.id} loaded.`);

  const retrieval = retrieveWorkspaceContext(input.workspace, question);
  addDecision(
    decisionLog,
    "schema_retrieval",
    `Retrieved ${retrieval.candidateTables.length} candidate tables and ${retrieval.candidateColumns.length} candidate columns.`,
    { retrievalScore: retrieval.retrievalScore }
  );

  const historical = retrieveHistoricalQueries(input.workspace, question);
  addDecision(decisionLog, "historical_retrieval", `Retrieved ${historical.length} historical SQL examples.`);

  const relationshipPaths = rankRelationshipPaths(input.workspace, retrieval);
  const selectedPath = relationshipPaths[0] ?? null;
  addDecision(decisionLog, "relationship_paths", `Ranked ${relationshipPaths.length} relationship paths.`);

  const activeMemory = input.workspace.memoryRules.filter((rule) => rule.enabled !== false);
  const interpretationPrompt = buildQuestionInterpretationPrompt({
    question,
    dialect: input.request.dialect,
    retrieval,
    historical,
    paths: relationshipPaths,
    memory: activeMemory
  });
  const interpretation = await input.provider.generateStructured<QuestionInterpretation>({
    name: "question_interpretation",
    schema: questionInterpretationSchema,
    ...interpretationPrompt
  });
  addDecision(decisionLog, "question_interpretation", interpretation.requestSummary, {
    requiresClarification: interpretation.requiresClarification
  });

  const generationPrompt = buildSqlGenerationPrompt({
    dialect: input.request.dialect,
    interpretation,
    retrieval,
    selectedPath,
    historical,
    memory: activeMemory
  });
  let draft = await input.provider.generateStructured<GeneratedSqlDraft>({
    name: "sql_generation",
    schema: generatedSqlDraftSchema,
    ...generationPrompt
  });
  addDecision(decisionLog, "sql_generation", draft.explanation);

  let validation = validateGeneratedSql(draft.sql, input.workspace.schema, {
    safeMode: input.request.safeMode
  });
  let attempts = 0;

  while (!validation.valid && attempts < MAX_CONTROLLED_REGENERATION_ATTEMPTS) {
    attempts += 1;
    const regenerationPrompt = buildControlledRegenerationPrompt({
      previousDraft: draft,
      validationIssues: validation.issues,
      allowedContext: {
        retrieval,
        selectedPath,
        dialect: input.request.dialect
      }
    });
    draft = await input.provider.generateStructured<GeneratedSqlDraft>({
      name: "controlled_regeneration",
      schema: generatedSqlDraftSchema,
      ...regenerationPrompt
    });
    validation = validateGeneratedSql(draft.sql, input.workspace.schema, {
      safeMode: input.request.safeMode
    });
    addDecision(decisionLog, "controlled_regeneration", `Attempt ${attempts} completed.`, {
      valid: validation.valid
    });
  }

  if (!validation.valid) {
    addDecision(decisionLog, "validation_rejected", "Generated SQL failed deterministic validation.", {
      issues: validation.issues
    });
  } else {
    addDecision(decisionLog, "validation_passed", "Generated SQL passed deterministic schema and Safe Mode validation.");
  }

  const queryVersion = input.createQueryVersion
    ? await input.createQueryVersion({
        question,
        interpretation: interpretation.requestSummary,
        sql: draft.sql,
        validation,
        metadata: {
          retrieval,
          historical,
          relationshipPaths,
          decisionLog
        }
      })
    : undefined;

  return {
    question,
    interpretation: interpretation.requestSummary,
    sql: draft.sql,
    dialect: input.request.dialect,
    relationshipPath: selectedPath?.relationships ?? [],
    alternativePaths: relationshipPaths.slice(1),
    schemaSelection: retrieval,
    historicalEvidence: historical,
    businessTermEvidence: retrieval.matchedBusinessTerms,
    workspaceMemoryEvidence: activeMemory,
    evidence: buildEvidence({
      retrievalScore: retrieval.retrievalScore,
      historicalCount: historical.length,
      glossaryCount: retrieval.matchedBusinessTerms.length,
      aliasCount: retrieval.matchedAliases.length,
      relationshipPathCount: relationshipPaths.length,
      validation
    }),
    confidence: calculateApplicationConfidence({
      retrievalScore: retrieval.retrievalScore,
      historicalCount: historical.length,
      validation
    }),
    validation,
    ambiguities: [...interpretation.ambiguities, ...draft.ambiguities],
    assumptions: draft.assumptions,
    ...(queryVersion ? { queryVersion } : {}),
    decisionLog,
    generatedAt: new Date().toISOString(),
    engine: input.provider.name === "openai" ? "provider:openai" : input.provider.name === "mock" ? "mock:test" : "provider:disabled"
  };
}

function buildEvidence(input: {
  retrievalScore: number;
  historicalCount: number;
  glossaryCount: number;
  aliasCount: number;
  relationshipPathCount: number;
  validation: ValidationResult;
}): GenerationEvidence[] {
  return [
    {
      label: "Schema retrieval",
      description: `Application retrieval score: ${input.retrievalScore}.`,
      confidence: Math.min(1, input.retrievalScore / 100),
      source: "schema"
    },
    {
      label: "Historical SQL",
      description: `${input.historicalCount} retrieved historical examples influenced context.`,
      confidence: Math.min(1, input.historicalCount / 4),
      source: "history"
    },
    {
      label: "Business glossary",
      description: `${input.glossaryCount} enabled glossary terms matched the question.`,
      confidence: input.glossaryCount > 0 ? 0.85 : 0,
      source: "glossary"
    },
    {
      label: "Schema aliases",
      description: `${input.aliasCount} aliases matched the question.`,
      confidence: input.aliasCount > 0 ? 0.8 : 0,
      source: "alias"
    },
    {
      label: "Relationship paths",
      description: `${input.relationshipPathCount} candidate relationship paths were ranked.`,
      confidence: input.relationshipPathCount > 0 ? 0.85 : 0.2,
      source: "relationship"
    },
    {
      label: "SQL validation",
      description: input.validation.valid
        ? "SQL passed deterministic schema and Safe Mode validation."
        : "SQL was rejected by deterministic validation.",
      confidence: input.validation.valid ? 1 : 0,
      source: "validation"
    }
  ];
}

function calculateApplicationConfidence(input: {
  retrievalScore: number;
  historicalCount: number;
  validation: ValidationResult;
}): number {
  if (!input.validation.valid) {
    return 0;
  }

  return Math.min(0.95, 0.45 + Math.min(0.3, input.retrievalScore / 300) + Math.min(0.2, input.historicalCount * 0.05));
}

function addDecision(
  log: DecisionLogEntry[],
  stage: string,
  message: string,
  metadata?: Record<string, unknown>
): void {
  log.push({
    id: `decision_${log.length + 1}`,
    stage,
    message,
    ...(metadata ? { metadata } : {}),
    createdAt: new Date().toISOString()
  });
}
