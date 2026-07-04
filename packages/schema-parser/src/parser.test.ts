import { describe, expect, it } from "vitest";
import { parseDDL } from "./index.js";

describe("parseDDL", () => {
  it("parsuje tabele, kolumny i klucz glowny", () => {
    const result = parseDDL(
      `CREATE TABLE students (
        id integer primary key,
        email varchar(255) not null unique,
        created_at timestamp default now()
      );`,
      "postgresql"
    );

    expect(result.schema.tables).toHaveLength(1);
    expect(result.schema.tables[0]?.name).toBe("students");
    expect(result.schema.tables[0]?.primaryKey).toEqual(["id"]);
    expect(result.schema.tables[0]?.columns.find((column) => column.name === "email")?.unique).toBe(
      true
    );
  });

  it("parsuje relacje z ALTER TABLE", () => {
    const result = parseDDL(
      `CREATE TABLE departments (id integer primary key);
       CREATE TABLE students (id integer primary key, department_id integer);
       ALTER TABLE students ADD CONSTRAINT fk_department FOREIGN KEY (department_id) REFERENCES departments(id);`,
      "postgresql"
    );

    expect(result.schema.relationships).toHaveLength(1);
    expect(result.schema.relationships[0]).toMatchObject({
      fromTable: "students",
      fromColumn: "department_id",
      toTable: "departments",
      toColumn: "id"
    });
  });

  it("zwraca ostrzezenia dla nieobslugiwanych polecen", () => {
    const result = parseDDL("CREATE INDEX idx_students_email ON students(email);", "postgresql");

    expect(result.skippedStatements).toHaveLength(1);
    expect(result.warnings[0]).toContain("Pominieto");
  });
});
