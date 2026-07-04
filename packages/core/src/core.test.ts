import { describe, expect, it } from "vitest";
import {
  calculateWorkspaceHealth,
  createUniversityDemoWorkspace,
  findRelationshipPath,
  generateReadOnlySql
} from "./index.js";

describe("core", () => {
  it("tworzy workspace demo z relacjami, historia i slownikiem", () => {
    const workspace = createUniversityDemoWorkspace();

    expect(workspace.schema.tables.length).toBeGreaterThanOrEqual(5);
    expect(workspace.schema.relationships.length).toBeGreaterThanOrEqual(4);
    expect(workspace.historicalQueries).toHaveLength(3);
    expect(workspace.glossary.length).toBeGreaterThanOrEqual(4);
  });

  it("liczy deterministyczne zdrowie workspace", () => {
    const health = calculateWorkspaceHealth(createUniversityDemoWorkspace());

    expect(health.score).toBeGreaterThan(70);
    expect(health.blockers).toEqual([]);
  });

  it("znajduje sciezke relacji miedzy studentami i ocenami", () => {
    const path = findRelationshipPath(createUniversityDemoWorkspace(), "students", "grades");

    expect(path.map((relationship) => relationship.id)).toEqual([
      "enrollments.student_id->students.id",
      "grades.enrollment_id->enrollments.id"
    ]);
  });

  it("generuje read-only SQL z walidacja i evidence", () => {
    const workspace = createUniversityDemoWorkspace();
    const result = generateReadOnlySql({
      workspace,
      question: "Pokaz aktywnych studentow z wydzialem",
      safeMode: true
    });

    expect(result.sql).toContain("SELECT");
    expect(result.sql).toContain("JOIN departments");
    expect(result.validation.valid).toBe(true);
    expect(result.evidence.length).toBeGreaterThanOrEqual(3);
  });
});
