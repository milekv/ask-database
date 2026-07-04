import type { SqlDialect } from "@ask-database/shared";

export function buildHistoricalQuerySummaryPrompt(input: {
  dialect: SqlDialect;
  sanitizedSql: string;
}): { system: string; user: string } {
  return {
    system:
      "You summarize sanitized historical SQL for ASK DATABASE retrieval. Do not infer literal values. Return concise plain text.",
    user: JSON.stringify(
      {
        task: "Summarize the structural business purpose of this sanitized SQL.",
        dialect: input.dialect,
        sanitizedSql: input.sanitizedSql
      },
      null,
      2
    )
  };
}
