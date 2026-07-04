import { describe, expect, it } from "vitest";
import type { DatabaseSchema } from "@ask-database/shared";
import { assertReadOnlySql, validateGeneratedSql } from "./index.js";

const schema: DatabaseSchema = {
  dialect: "postgresql",
  version: "v1",
  tables: [
    {
      name: "students",
      columns: [
        { name: "id", dataType: "integer", nullable: false, primaryKey: true, unique: true },
        { name: "email", dataType: "text", nullable: false, primaryKey: false, unique: true }
      ],
      primaryKey: ["id"],
      uniqueKeys: [["email"]]
    },
    {
      name: "departments",
      columns: [
        { name: "id", dataType: "integer", nullable: false, primaryKey: true, unique: true },
        { name: "name", dataType: "text", nullable: false, primaryKey: false, unique: true }
      ],
      primaryKey: ["id"],
      uniqueKeys: [["name"]]
    }
  ],
  relationships: [],
  warnings: []
};

describe("sql-validator", () => {
  it("blokuje DELETE w Safe Mode", () => {
    const result = validateGeneratedSql("delete from students where id = 1", schema, {
      safeMode: true
    });

    expect(result.valid).toBe(false);
    expect(result.readOnly).toBe(false);
  });

  it("akceptuje pojedynczy SELECT", () => {
    expect(assertReadOnlySql("select id from students")).toBe(true);
  });

  it("wykrywa nieznana tabele", () => {
    const result = validateGeneratedSql("select id from payments", schema, { safeMode: true });

    expect(result.issues.some((issue) => issue.code === "UNKNOWN_TABLE")).toBe(true);
  });

  it("ostrzega przed SELECT *", () => {
    const result = validateGeneratedSql("select * from students", schema, { safeMode: true });

    expect(result.issues.some((issue) => issue.code === "SELECT_STAR")).toBe(true);
  });

  it("odrzuca nieznana kwalifikowana kolumne", () => {
    const result = validateGeneratedSql("select s.missing from students s", schema, { safeMode: true });

    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === "UNKNOWN_COLUMN")).toBe(true);
  });

  it("odrzuca nieznany alias", () => {
    const result = validateGeneratedSql("select x.id from students s", schema, { safeMode: true });

    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === "UNKNOWN_ALIAS")).toBe(true);
  });

  it("oznacza niekwalifikowana kolumne z wielu tabel jako ambiwalentna", () => {
    const result = validateGeneratedSql(
      "select id from students s join departments d on d.id = s.id",
      schema,
      { safeMode: true }
    );

    expect(result.valid).toBe(true);
    expect(result.issues.some((issue) => issue.code === "AMBIGUOUS_COLUMN")).toBe(true);
  });

  it("akceptuje podstawowe CTE read-only", () => {
    const result = validateGeneratedSql(
      "with recent as (select id, email from students) select id from recent",
      schema,
      { safeMode: true }
    );

    expect(result.valid).toBe(true);
    expect(result.readOnly).toBe(true);
  });
});
