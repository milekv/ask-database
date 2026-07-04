export function buildCorrectionInterpretationPrompt(input: {
  correction: string;
  currentInterpretation: unknown;
  currentSql: string;
  schemaContext: unknown;
  alternativePaths: unknown;
}): { system: string; user: string } {
  return {
    system:
      "You interpret a user correction for ASK DATABASE. Identify required and rejected schema objects, filter changes, relationship path changes, and an optional memory proposal.",
    user: JSON.stringify(
      {
        task: "Interpret the correction into structured query-context changes.",
        correction: input.correction,
        currentInterpretation: input.currentInterpretation,
        currentSql: input.currentSql,
        schemaContext: input.schemaContext,
        alternativePaths: input.alternativePaths
      },
      null,
      2
    )
  };
}
