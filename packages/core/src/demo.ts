import { parseDDL } from "@ask-database/schema-parser";
import type { BusinessTerm, CorrectionMemory, Workspace, WorkspaceMemoryRule } from "@ask-database/shared";
import { importHistoricalQueries, learnQueryPatterns } from "@ask-database/sql-memory";

export const universityDemoDdl = `
CREATE TABLE departments (
  id integer primary key,
  name varchar(160) not null unique,
  code varchar(24) not null unique
);

CREATE TABLE students (
  id integer primary key,
  department_id integer not null references departments(id),
  full_name varchar(220) not null,
  email varchar(220) not null unique,
  status varchar(32) not null,
  created_at timestamp not null
);

CREATE TABLE courses (
  id integer primary key,
  department_id integer not null references departments(id),
  code varchar(32) not null unique,
  title varchar(220) not null,
  credits integer not null
);

CREATE TABLE enrollments (
  id integer primary key,
  student_id integer not null references students(id),
  course_id integer not null references courses(id),
  enrolled_at timestamp not null
);

CREATE TABLE grades (
  id integer primary key,
  enrollment_id integer not null references enrollments(id),
  grade numeric(4,2) not null,
  graded_at timestamp not null
);
`;

export const universityHistoricalSql = `
SELECT s.id, s.full_name, s.email, d.name AS department_name
FROM students s
JOIN departments d ON s.department_id = d.id
WHERE s.status = 'active'
ORDER BY s.created_at DESC
LIMIT 50;

SELECT c.code, c.title, COUNT(e.id) AS enrollment_count
FROM courses c
LEFT JOIN enrollments e ON e.course_id = c.id
GROUP BY c.code, c.title
ORDER BY enrollment_count DESC
LIMIT 20;

SELECT s.full_name, c.title, g.grade
FROM students s
JOIN enrollments e ON e.student_id = s.id
JOIN courses c ON e.course_id = c.id
JOIN grades g ON g.enrollment_id = e.id
WHERE g.grade >= 4.5
ORDER BY g.grade DESC;
`;

export const universityGlossary: BusinessTerm[] = [
  {
    id: "term_active_students",
    name: "aktywni studenci",
    aliases: ["active students", "studenci aktywni", "aktywnych studentow"],
    description: "Studenci z aktualnym statusem active.",
    sqlExpression: "students.status = 'active'",
    relatedTables: ["students"],
    relatedColumns: ["students.status"]
  },
  {
    id: "term_department",
    name: "wydzial",
    aliases: ["department", "katedra", "jednostka"],
    description: "Jednostka organizacyjna przypisana do studenta i kursu.",
    relatedTables: ["departments"],
    relatedColumns: ["departments.id", "departments.name"]
  },
  {
    id: "term_course_load",
    name: "popularnosc kursu",
    aliases: ["course popularity", "liczba zapisow", "najpopularniejsze kursy"],
    description: "Liczba zapisow studentow na kurs.",
    sqlExpression: "COUNT(enrollments.id)",
    relatedTables: ["courses", "enrollments"],
    relatedColumns: ["courses.id", "enrollments.course_id"]
  },
  {
    id: "term_high_grades",
    name: "wysokie oceny",
    aliases: ["high grades", "najlepsze oceny", "oceny powyzej 4.5"],
    description: "Oceny rowne lub wyzsze niz 4.5.",
    sqlExpression: "grades.grade >= 4.5",
    relatedTables: ["grades"],
    relatedColumns: ["grades.grade"]
  }
];

export const universityMemoryRules: WorkspaceMemoryRule[] = [
  {
    id: "memory_safe_read_only",
    title: "Domyslnie tylko odczyt",
    description: "Wersja 0.1.0 generuje wylacznie SELECT/WITH i waliduje wynik przed pokazaniem.",
    appliesTo: "safety",
    confidence: 1
  },
  {
    id: "memory_students_department",
    title: "Studenci laczeni z wydzialami przez department_id",
    description: "Preferowana sciezka relacji to students.department_id -> departments.id.",
    appliesTo: "relationship",
    confidence: 1
  },
  {
    id: "memory_limit_public_lists",
    title: "Listy wynikow maja limit",
    description: "Dla ogolnych list uzywaj LIMIT 50, aby unikac niekontrolowanych wynikow.",
    appliesTo: "safety",
    confidence: 0.9
  }
];

export const universityCorrections: CorrectionMemory[] = [
  {
    id: "correction_department_wording",
    originalQuestion: "pokaz ludzi z informatyki",
    correctedSql:
      "SELECT s.id, s.full_name, s.email FROM students s JOIN departments d ON s.department_id = d.id WHERE d.name = 'Informatyka' LIMIT 50;",
    reason: "W tym workspace slowo 'ludzie' w pytaniach akademickich oznacza studentow, nie pracownikow.",
    createdAt: "2026-07-04T00:00:00.000Z"
  }
];

export function createUniversityDemoWorkspace(): Workspace {
  const parsedSchema = parseDDL(universityDemoDdl, "postgresql").schema;
  const historicalQueries = importHistoricalQueries(
    universityHistoricalSql,
    "postgresql"
  ).imported;

  return {
    id: "university-demo",
    name: "University Demo",
    description: "Syntetyczny workspace pokazujacy schemat uczelni, relacje, zapytania historyczne i slownik biznesowy.",
    dialect: "postgresql",
    schema: parsedSchema,
    historicalQueries,
    queryPatterns: learnQueryPatterns(historicalQueries),
    glossary: universityGlossary,
    memoryRules: universityMemoryRules,
    corrections: universityCorrections,
    createdAt: "2026-07-04T00:00:00.000Z",
    updatedAt: "2026-07-04T00:00:00.000Z"
  };
}
