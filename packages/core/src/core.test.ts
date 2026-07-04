import { describe, expect, it } from "vitest";
import {
  askDatabase,
  calculateWorkspaceHealth,
  createUniversityDemoWorkspace,
  findRelationshipPath,
  MockLLMProvider,
  rankRelationshipPaths,
  retrieveHistoricalQueries,
  retrieveWorkspaceContext
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

  it("retrieval wybiera kandydatow schematu bez hardcodowanych scenariuszy", () => {
    const workspace = createUniversityDemoWorkspace();
    const retrieval = retrieveWorkspaceContext(
      workspace,
      "Pokaz studentow z wysokimi ocenami na kursach"
    );

    expect(retrieval.candidateTables.map((candidate) => candidate.table.name)).toContain("students");
    expect(retrieval.retrievalEvidence.length).toBeGreaterThan(0);
  });

  it("retrieval normalizuje polskie odmiany i aliasy z diakrytykami", () => {
    const workspace = createUniversityDemoWorkspace();
    workspace.aliases = [
      {
        id: "alias_started_studies",
        targetType: "column",
        targetId: "students.created_at",
        alias: "rozpoczął studia",
        language: "pl",
        enabled: true
      }
    ];

    const studentRetrieval = retrieveWorkspaceContext(workspace, "Pokaż studentów z oceną 5");
    const admissionRetrieval = retrieveWorkspaceContext(
      workspace,
      "Pokaż osoby, które rozpoczely studia po 2022"
    );

    expect(studentRetrieval.candidateTables.map((candidate) => candidate.table.name)).toContain("students");
    expect(admissionRetrieval.matchedAliases.map((alias) => alias.id)).toContain("alias_started_studies");
    expect(admissionRetrieval.candidateColumns.map((candidate) => `${candidate.tableName}.${candidate.column.name}`)).toContain(
      "students.created_at"
    );
  });

  it("historical retriever zwraca tylko relewantne przyklady z evidence", () => {
    const workspace = createUniversityDemoWorkspace();
    const matches = retrieveHistoricalQueries(workspace, "kursy z ocenami studentow");

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]?.evidence.length).toBeGreaterThan(0);
  });

  it("relationship ranker zwraca punktowane sciezki", () => {
    const workspace = createUniversityDemoWorkspace();
    const retrieval = retrieveWorkspaceContext(workspace, "studenci kursy oceny");
    const paths = rankRelationshipPaths(workspace, retrieval);

    expect(paths.length).toBeGreaterThan(0);
    expect(paths[0]?.score).toBeGreaterThan(0);
  });

  it("workspace memory preferuje potwierdzona sciezke relacji i ignoruje ja po wylaczeniu", () => {
    const workspace = createUniversityDemoWorkspace();
    workspace.schema.relationships.push({
      id: "final_grades.student_id->students.id",
      fromTable: "final_grades",
      fromColumn: "student_id",
      toTable: "students",
      toColumn: "id",
      confidence: 0.7,
      source: "inferred"
    });
    workspace.schema.tables.push({
      name: "final_grades",
      columns: [
        { name: "id", dataType: "integer", nullable: false, primaryKey: true, unique: true },
        { name: "student_id", dataType: "integer", nullable: false, primaryKey: false, unique: false },
        { name: "grade", dataType: "numeric", nullable: false, primaryKey: false, unique: false }
      ],
      primaryKey: ["id"],
      uniqueKeys: []
    });
    workspace.glossary.push({
      id: "term_final_grades",
      name: "ocena",
      aliases: ["grade", "oceny"],
      description: "Ocena studenta.",
      relatedTables: ["students", "final_grades", "grades", "enrollments"],
      relatedColumns: ["final_grades.grade", "grades.grade"]
    });

    const retrieval = retrieveWorkspaceContext(workspace, "Pokaż studentów z oceną 5");
    const withoutMemory = rankRelationshipPaths(workspace, retrieval);
    expect(withoutMemory.length).toBeGreaterThan(0);

    workspace.memoryRules.push({
      id: "memory_course_grade_path",
      title: "Oceny przez zapisy na kurs",
      description: "Preferuj students -> enrollments -> grades i unikaj final_grades.",
      appliesTo: "relationship",
      confidence: 1,
      enabled: true,
      priority: "high",
      scope: "workspace",
      source: "user-correction",
      payload: {
        preferredTables: ["enrollments", "grades"],
        rejectedTables: ["final_grades"]
      }
    });
    const withMemory = rankRelationshipPaths(workspace, retrieval);
    expect(withMemory[0]?.tables).toContain("grades");
    expect(withMemory[0]?.tables).not.toContain("final_grades");
    expect(withMemory[0]?.evidence.some((item) => item.targetId === "memory_course_grade_path")).toBe(true);

    workspace.memoryRules[workspace.memoryRules.length - 1]!.enabled = false;
    const disabledMemory = rankRelationshipPaths(workspace, retrieval);
    expect(disabledMemory[0]?.evidence.some((item) => item.targetId === "memory_course_grade_path")).toBe(false);
  });

  it("askDatabase orkiestruje provider, retrieval i walidacje", async () => {
    const workspace = createUniversityDemoWorkspace();
    const provider = new MockLLMProvider();
    provider.queueStructured({
      requestSummary: "Studenci z kursami i wysokimi ocenami.",
      requestedEntities: ["students", "courses", "grades"],
      requestedFields: ["students.full_name", "courses.title", "grades.grade"],
      filters: ["grades.grade >= 4.5"],
      aggregations: [],
      grouping: [],
      sorting: ["grades.grade DESC"],
      limit: 50,
      exclusions: [],
      existenceConditions: [],
      matchedBusinessTerms: ["wysokie oceny"],
      candidateTableIds: ["students", "courses", "grades"],
      candidateColumnIds: ["students.full_name", "courses.title", "grades.grade"],
      ambiguities: [],
      requiresClarification: false
    });
    provider.queueStructured({
      sql: `SELECT
  s.full_name,
  c.title,
  g.grade
FROM students s
JOIN enrollments e ON e.student_id = s.id
JOIN courses c ON e.course_id = c.id
JOIN grades g ON g.enrollment_id = e.id
WHERE g.grade >= 4.5
ORDER BY g.grade DESC
LIMIT 50;`,
      tableIdsUsed: ["students", "enrollments", "courses", "grades"],
      columnIdsUsed: ["students.full_name", "courses.title", "grades.grade"],
      relationshipIdsUsed: [
        "enrollments.student_id->students.id",
        "enrollments.course_id->courses.id",
        "grades.enrollment_id->enrollments.id"
      ],
      assumptions: [],
      ambiguities: [],
      explanation: "Generated from retrieved schema and relationship context."
    });

    const result = await askDatabase({
      workspace,
      provider,
      request: {
        workspaceId: workspace.id,
        question: "Pokaz studentow z wysokimi ocenami",
        dialect: "postgresql",
        safeMode: true
      }
    });

    expect(result.engine).toBe("mock:test");
    expect(result.validation.valid).toBe(true);
    expect(result.sql).toContain("JOIN grades");
    expect(result.schemaSelection?.candidateTables.length).toBeGreaterThan(0);
    expect(result.historicalEvidence?.length).toBeGreaterThan(0);
  });
});
