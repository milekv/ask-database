import type {
  HistoricalQueryMatch,
  RelationshipPathCandidate,
  SchemaRetrievalResult,
  SqlDialect,
  WorkspaceMemoryRule
} from "@ask-database/shared";

export function buildQuestionInterpretationPrompt(input: {
  question: string;
  dialect: SqlDialect;
  retrieval: SchemaRetrievalResult;
  historical: HistoricalQueryMatch[];
  paths: RelationshipPathCandidate[];
  memory: WorkspaceMemoryRule[];
}): { system: string; user: string } {
  return {
    system:
      "You interpret database questions for ASK DATABASE. Use only schema object IDs provided in context. Do not invent tables or columns. Return only the requested structured object.",
    user: JSON.stringify(
      {
        task: "Interpret the user question into schema IDs and query intent.",
        dialect: input.dialect,
        question: input.question,
        candidateTables: input.retrieval.candidateTables.map((candidate) => ({
          id: candidate.table.name,
          name: candidate.table.name,
          columns: candidate.table.columns.map((column) => column.name),
          score: candidate.score
        })),
        candidateColumns: input.retrieval.candidateColumns.map((candidate) => ({
          id: `${candidate.tableName}.${candidate.column.name}`,
          table: candidate.tableName,
          column: candidate.column.name,
          score: candidate.score
        })),
        matchedAliases: input.retrieval.matchedAliases,
        matchedBusinessTerms: input.retrieval.matchedBusinessTerms,
        candidateRelationshipPaths: input.paths.map((path) => ({
          ids: path.relationships.map((relationship) => relationship.id),
          tables: path.tables,
          score: path.score,
          evidence: path.evidence
        })),
        historicalExamples: input.historical.map((match) => ({
          id: match.query.id,
          sanitizedSql: match.query.redactedSql,
          summary: match.query.semanticSummary ?? null,
          score: match.score,
          evidence: match.evidence
        })),
        workspaceMemory: input.memory.filter((rule) => rule.enabled !== false)
      },
      null,
      2
    )
  };
}
