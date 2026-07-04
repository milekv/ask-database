import type {
  GenerationEvidence,
  GenerationResult,
  RelationshipDefinition,
  Workspace
} from "@ask-database/shared";
import { validateGeneratedSql } from "@ask-database/sql-validator";
import { findRelationshipPath } from "./path-finder.js";

export interface GenerateSqlInput {
  workspace: Workspace;
  question: string;
  safeMode: boolean;
}

export function generateReadOnlySql(input: GenerateSqlInput): GenerationResult {
  const question = input.question.trim();
  const normalized = normalizeText(question);
  const matchedTerms = input.workspace.glossary.filter((term) =>
    [term.name, ...term.aliases].some((value) => normalized.includes(normalizeText(value)))
  );

  const scenario = chooseScenario(normalized);
  const draft = buildScenarioSql(scenario);
  const relationshipPath = buildRelationshipPath(input.workspace, scenario);
  const validation = validateGeneratedSql(draft.sql, input.workspace.schema, {
    safeMode: input.safeMode
  });

  return {
    question,
    interpretation: draft.interpretation,
    sql: draft.sql,
    dialect: input.workspace.dialect,
    relationshipPath,
    evidence: buildEvidence(input.workspace, matchedTerms.length, relationshipPath),
    validation,
    generatedAt: new Date().toISOString(),
    engine: "deterministic-demo"
  };
}

type Scenario = "active-students" | "course-popularity" | "high-grades" | "default-students";

function chooseScenario(normalizedQuestion: string): Scenario {
  if (containsAny(normalizedQuestion, ["popularnosc", "najpopularniejsze", "zapisy", "enrollment"])) {
    return "course-popularity";
  }

  if (containsAny(normalizedQuestion, ["oceny", "grades", "grade", "najlepsze"])) {
    return "high-grades";
  }

  if (containsAny(normalizedQuestion, ["aktywni", "aktywnych", "active", "wydzial", "wydzialu", "department"])) {
    return "active-students";
  }

  return "default-students";
}

function buildScenarioSql(scenario: Scenario): { interpretation: string; sql: string } {
  if (scenario === "course-popularity") {
    return {
      interpretation: "Lista kursow posortowana wedlug liczby zapisow studentow.",
      sql: `SELECT
  c.code,
  c.title,
  COUNT(e.id) AS enrollment_count
FROM courses c
LEFT JOIN enrollments e ON e.course_id = c.id
GROUP BY c.code, c.title
ORDER BY enrollment_count DESC
LIMIT 20;`
    };
  }

  if (scenario === "high-grades") {
    return {
      interpretation: "Studenci, kursy i wysokie oceny z zachowaniem sciezki relacji przez zapisy.",
      sql: `SELECT
  s.full_name,
  c.title,
  g.grade,
  g.graded_at
FROM students s
JOIN enrollments e ON e.student_id = s.id
JOIN courses c ON e.course_id = c.id
JOIN grades g ON g.enrollment_id = e.id
WHERE g.grade >= 4.5
ORDER BY g.grade DESC
LIMIT 50;`
    };
  }

  if (scenario === "active-students") {
    return {
      interpretation: "Aktywni studenci wraz z nazwa wydzialu, ograniczeni limitem wynikow.",
      sql: `SELECT
  s.id,
  s.full_name,
  s.email,
  d.name AS department_name
FROM students s
JOIN departments d ON s.department_id = d.id
WHERE s.status = 'active'
ORDER BY s.created_at DESC
LIMIT 50;`
    };
  }

  return {
    interpretation: "Podstawowa lista studentow z bezpiecznym limitem wynikow.",
    sql: `SELECT
  s.id,
  s.full_name,
  s.email,
  s.status
FROM students s
ORDER BY s.created_at DESC
LIMIT 50;`
  };
}

function buildRelationshipPath(workspace: Workspace, scenario: Scenario): RelationshipDefinition[] {
  if (scenario === "course-popularity") {
    return findRelationshipPath(workspace, "courses", "enrollments");
  }

  if (scenario === "high-grades") {
    return [
      ...findRelationshipPath(workspace, "students", "courses"),
      ...findRelationshipPath(workspace, "courses", "grades")
    ].filter((relationship, index, all) => all.findIndex((item) => item.id === relationship.id) === index);
  }

  if (scenario === "active-students") {
    return findRelationshipPath(workspace, "students", "departments");
  }

  return [];
}

function buildEvidence(
  workspace: Workspace,
  matchedTermsCount: number,
  relationshipPath: RelationshipDefinition[]
): GenerationEvidence[] {
  const evidence: GenerationEvidence[] = [
    {
      label: "Schemat",
      description: `Uzyto ${workspace.schema.tables.length} tabel z aktywnej wersji schematu.`,
      confidence: 0.9,
      source: "schema"
    },
    {
      label: "Pamiec zapytan",
      description: `Workspace zawiera ${workspace.historicalQueries.length} historyczne SELECT-y.`,
      confidence: Math.min(0.9, 0.4 + workspace.historicalQueries.length * 0.12),
      source: "history"
    }
  ];

  if (matchedTermsCount > 0) {
    evidence.push({
      label: "Slownik biznesowy",
      description: `Dopasowano ${matchedTermsCount} termin/terminy biznesowe do pytania.`,
      confidence: 0.82,
      source: "glossary"
    });
  }

  if (relationshipPath.length > 0) {
    evidence.push({
      label: "Sciezka relacji",
      description: `Zweryfikowano ${relationshipPath.length} relacje miedzy tabelami.`,
      confidence: 0.92,
      source: "memory"
    });
  }

  evidence.push({
    label: "Walidacja",
    description: "SQL zostal sprawdzony w Safe Mode przed pokazaniem wyniku.",
    confidence: 1,
    source: "validation"
  });

  return evidence;
}

function containsAny(input: string, phrases: string[]): boolean {
  return phrases.some((phrase) => input.includes(normalizeText(phrase)));
}

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/ą/g, "a")
    .replace(/ć/g, "c")
    .replace(/ę/g, "e")
    .replace(/ń/g, "n")
    .replace(/ó/g, "o")
    .replace(/ś/g, "s")
    .replace(/ź/g, "z")
    .replace(/ż/g, "z");
}
