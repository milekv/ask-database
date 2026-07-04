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

    expect(result.issues.some((issue) => issue.code === "unknown_table")).toBe(true);
  });

  it("ostrzega przed SELECT *", () => {
    const result = validateGeneratedSql("select * from students", schema, { safeMode: true });

    expect(result.issues.some((issue) => issue.code === "select_star")).toBe(true);
  });
});
