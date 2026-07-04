import type { ValidationIssue } from "@ask-database/shared";
import type { GeneratedSqlDraft } from "./schemas.js";

export function buildControlledRegenerationPrompt(input: {
  previousDraft: GeneratedSqlDraft;
  validationIssues: ValidationIssue[];
  allowedContext: unknown;
}): { system: string; user: string } {
  return {
    system:
      "You repair an ASK DATABASE SQL draft after deterministic validation rejected it. Only fix the listed validation errors. Keep the query read-only and use only allowed schema objects.",
    user: JSON.stringify(
      {
        task: "Regenerate SQL by correcting validation errors.",
        previousDraft: input.previousDraft,
        validationIssues: input.validationIssues,
        allowedContext: input.allowedContext
      },
      null,
      2
    )
  };
}
