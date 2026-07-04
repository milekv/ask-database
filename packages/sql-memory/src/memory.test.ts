import { describe, expect, it } from "vitest";
import {
  analyzeHistoricalQuery,
  importHistoricalQueries,
  learnQueryPatterns,
  redactSqlLiterals
} from "./index.js";

describe("sql-memory", () => {
  it("redaguje literaly tekstowe i liczbowe", () => {
    expect(redactSqlLiterals("select * from students where email = 'a@b.pl' and age > 20")).toBe(
      "select * from students where email = ? and age > ?"
    );
  });

  it("importuje tylko SELECT i WITH", () => {
    const result = importHistoricalQueries(
      "select * from students; delete from students where id = 1;",
      "postgresql"
    );

    expect(result.imported).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
  });

  it("wyciaga tabele, joiny, filtry i order by", () => {
    const query = analyzeHistoricalQuery(
      `select s.id, d.name
       from students s
       join departments d on s.department_id = d.id
       where d.name = 'Informatyka'
       order by s.created_at desc`,
      "postgresql"
    );

    expect(query.tables).toEqual(["students", "departments"]);
    expect(query.joins[0]?.rawCondition).toContain("s.department_id");
    expect(query.filters[0]?.column).toBe("d.name");
    expect(query.orderBy).toEqual(["s.created_at"]);
  });

  it("uczy deterministyczne wzorce z podobnych zapytan", () => {
    const queries = importHistoricalQueries(
      `select * from students s join departments d on s.department_id = d.id;
       select s.email from students s join departments d on s.department_id = d.id;`,
      "postgresql"
    ).imported;

    const patterns = learnQueryPatterns(queries);

    expect(patterns).toHaveLength(1);
    expect(patterns[0]?.confidence).toBeGreaterThan(0.6);
  });
});
