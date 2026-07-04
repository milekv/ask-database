import type {
  HistoricalQueryMatch,
  RelationshipPathCandidate,
  SchemaRetrievalResult,
  SqlDialect,
  WorkspaceMemoryRule
} from "@ask-database/shared";
import type { QuestionInterpretation } from "./schemas.js";

export function buildSqlGenerationPrompt(input: {
  dialect: SqlDialect;
  interpretation: QuestionInterpretation;
  retrieval: SchemaRetrievalResult;
  selectedPath: RelationshipPathCandidate | null;
  historical: HistoricalQueryMatch[];
  memory: WorkspaceMemoryRule[];
}): { system: string; user: string } {
  return {
    system:
      "You generate read-only SQL for ASK DATABASE. Use only supplied schema objects and relationship paths. Generate SELECT or WITH only. Return only the structured SQL draft.",
    user: JSON.stringify(
      {
        task: "Generate a validated SQL draft from the interpretation and retrieved workspace context.",
        dialect: input.dialect,
        interpretation: input.interpretation,
        allowedTables: input.retrieval.candidateTables.map((candidate) => candidate.table),
        allowedColumns: input.retrieval.candidateColumns.map((candidate) => ({
          table: candidate.tableName,
          column: candidate.column
        })),
        selectedRelationshipPath: input.selectedPath,
        businessTerms: input.retrieval.matchedBusinessTerms,
        historicalExamples: input.historical.map((match) => ({
          id: match.query.id,
          sanitizedSql: match.query.redactedSql,
          summary: match.query.semanticSummary ?? null,
          score: match.score
        })),
        confirmedWorkspaceMemory: input.memory.filter((rule) => rule.enabled !== false)
      },
      null,
      2
    )
  };
}
