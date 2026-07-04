import type { Workspace, WorkspaceHealth } from "@ask-database/shared";

export function calculateWorkspaceHealth(workspace: Workspace): WorkspaceHealth {
  const tableCount = workspace.schema.tables.length;
  const relationshipCoverage = tableCount <= 1
    ? 100
    : Math.min(100, Math.round((workspace.schema.relationships.length / (tableCount - 1)) * 100));
  const schemaCoverage = Math.min(100, tableCount * 18);
  const memoryCoverage = Math.min(100, workspace.historicalQueries.length * 20 + workspace.memoryRules.length * 10);
  const glossaryCoverage = Math.min(100, workspace.glossary.length * 18);
  const score = Math.round(
    schemaCoverage * 0.3 + relationshipCoverage * 0.25 + memoryCoverage * 0.25 + glossaryCoverage * 0.2
  );

  const blockers: string[] = [];
  const recommendations: string[] = [];

  if (tableCount === 0) {
    blockers.push("Brak tabel w schemacie.");
  }
  if (workspace.schema.relationships.length === 0 && tableCount > 1) {
    blockers.push("Brak relacji miedzy tabelami.");
  }
  if (workspace.historicalQueries.length < 3) {
    recommendations.push("Dodaj wiecej historycznych SELECT-ow, aby poprawic rozpoznawanie wzorcow.");
  }
  if (workspace.glossary.length < 5) {
    recommendations.push("Rozbuduj slownik biznesowy o nazwy uzywane przez zespol.");
  }

  return {
    score,
    schemaCoverage,
    relationshipCoverage,
    memoryCoverage,
    glossaryCoverage,
    blockers,
    recommendations
  };
}
