import type {
  DatabaseSchema,
  TableDefinition,
  ValidationIssue,
  ValidationResult
} from "@ask-database/shared";
import { normalizeSql, splitSqlStatements } from "@ask-database/shared";

export interface ValidateSqlOptions {
  safeMode: boolean;
}

const destructiveKeywords = /\b(insert|update|delete|merge|drop|truncate|alter|create|grant|revoke|call|execute)\b/i;

export function validateGeneratedSql(
  sql: string,
  schema: DatabaseSchema,
  options: ValidateSqlOptions
): ValidationResult {
  const normalized = normalizeSql(sql);
  const statements = splitSqlStatements(sql);
  const issues: ValidationIssue[] = [];

  if (statements.length !== 1) {
    issues.push({
      code: "MULTIPLE_STATEMENTS",
      severity: "error",
      message: "Safe Mode dopuszcza dokladnie jedno polecenie SQL."
    });
  }

  const readOnly = /^(select|with)\b/i.test(normalized) && !destructiveKeywords.test(normalized);

  if (!readOnly) {
    issues.push({
      code: destructiveKeywords.test(normalized) ? "DESTRUCTIVE_STATEMENT" : "UNSUPPORTED_STATEMENT",
      severity: "error",
      message: "ASK DATABASE v0.1.0 generuje tylko zapytania odczytujace dane.",
      fragment: firstWords(normalized, 5)
    });
  }

  if (options.safeMode && /\bselect\s+\*/i.test(normalized)) {
      issues.push({
        code: "SELECT_STAR",
      severity: "warning",
      message: "SELECT * utrudnia kontrole kolumn i moze zwiekszyc koszt zapytania.",
      fragment: "SELECT *"
    });
  }

  if (options.safeMode && /\border\s+by\b/i.test(normalized) && !/\blimit\b|\bfetch\s+first\b/i.test(normalized)) {
    issues.push({
      code: "UNBOUNDED_ORDER",
      severity: "warning",
      message: "ORDER BY bez LIMIT moze wymusic sortowanie duzego wyniku.",
      fragment: extractFragment(normalized, "order by")
    });
  }

  const cteNames = extractCteNames(normalized);
  const aliases = extractAliases(normalized, cteNames);
  const referencedTables = Array.from(new Set(aliases.values()));
  const tableMap = new Map(schema.tables.map((table) => [table.name.toLowerCase(), table]));

  for (const table of referencedTables) {
    if (cteNames.has(table.toLowerCase())) {
      continue;
    }
    if (!tableMap.has(table.toLowerCase())) {
      issues.push({
        code: "UNKNOWN_TABLE",
        severity: "error",
        message: `Tabela ${table} nie istnieje w aktywnym schemacie.`,
        fragment: table
      });
    }
  }

  for (const issue of validateQualifiedColumns(normalized, tableMap, aliases, cteNames)) {
    issues.push(issue);
  }

  for (const issue of validateUnqualifiedColumns(normalized, tableMap, referencedTables)) {
    issues.push(issue);
  }

  return {
    valid: issues.every((issue) => issue.severity !== "error"),
    readOnly,
    issues
  };
}

export function assertReadOnlySql(sql: string): boolean {
  const normalized = normalizeSql(sql);
  return /^(select|with)\b/i.test(normalized) && !destructiveKeywords.test(normalized);
}

function validateQualifiedColumns(
  sql: string,
  tableMap: Map<string, TableDefinition>,
  aliases: Map<string, string>,
  cteNames: Set<string>
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const qualifiedColumnPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)\b/g;

  for (const match of sql.matchAll(qualifiedColumnPattern)) {
    const alias = match[1];
    const column = match[2];
    if (!alias || !column) {
      continue;
    }

    const tableName = aliases.get(alias.toLowerCase()) ?? alias;
    if (cteNames.has(tableName.toLowerCase())) {
      continue;
    }
    const table = tableMap.get(tableName.toLowerCase());
    if (!table) {
      issues.push({
        code: "UNKNOWN_ALIAS",
        severity: "error",
        message: `Alias ${alias} nie jest zdefiniowany w zapytaniu.`,
        fragment: `${alias}.${column}`
      });
      continue;
    }

    const hasColumn = table.columns.some(
      (definition) => definition.name.toLowerCase() === column.toLowerCase()
    );
    if (!hasColumn) {
      issues.push({
        code: "UNKNOWN_COLUMN",
        severity: "error",
        message: `Kolumna ${table.name}.${column} nie istnieje w aktywnym schemacie.`,
        fragment: `${alias}.${column}`
      });
    }
  }

  return issues;
}

function validateUnqualifiedColumns(
  sql: string,
  tableMap: Map<string, TableDefinition>,
  referencedTables: string[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const selectedColumns = extractPotentialUnqualifiedColumns(sql);
  for (const column of selectedColumns) {
    const owningTables = referencedTables
      .map((table) => tableMap.get(table.toLowerCase()))
      .filter((table): table is TableDefinition => Boolean(table))
      .filter((table) =>
        table.columns.some((definition) => definition.name.toLowerCase() === column.toLowerCase())
      );

    if (owningTables.length === 0) {
      issues.push({
        code: "UNKNOWN_COLUMN",
        severity: "error",
        message: `Kolumna ${column} nie istnieje w wybranych tabelach.`,
        fragment: column
      });
    }

    if (owningTables.length > 1) {
      issues.push({
        code: "AMBIGUOUS_COLUMN",
        severity: "warning",
        message: `Kolumna ${column} wystepuje w wielu tabelach: ${owningTables.map((table) => table.name).join(", ")}.`,
        fragment: column
      });
    }
  }

  return issues;
}

function extractAliases(sql: string, cteNames: Set<string>): Map<string, string> {
  const aliases = new Map<string, string>();
  for (const cteName of cteNames) {
    aliases.set(cteName, cteName);
  }
  const relationPattern =
    /\b(from|join)\s+([a-zA-Z0-9_."`\[\]]+)(?:\s+(?:as\s+)?([a-zA-Z_][a-zA-Z0-9_]*))?/gi;

  for (const match of sql.matchAll(relationPattern)) {
    if (!match[2]) {
      continue;
    }

    const table = cleanIdentifier(match[2]);
    aliases.set(table.toLowerCase(), table);
    if (match[3] && !reservedAlias(match[3])) {
      aliases.set(match[3].toLowerCase(), table);
    }
  }

  return aliases;
}

function extractCteNames(sql: string): Set<string> {
  const cteNames = new Set<string>();
  const withMatch = sql.match(/^\s*with\s+(.+?)\s+select\b/i);
  const ctePrefix = withMatch?.[1] ?? "";
  for (const match of ctePrefix.matchAll(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s+as\s*\(/gi)) {
    if (match[1]) {
      cteNames.add(match[1].toLowerCase());
    }
  }

  return cteNames;
}

function reservedAlias(value: string): boolean {
  return ["on", "where", "join", "left", "right", "full", "inner", "group", "order", "limit"].includes(
    value.toLowerCase()
  );
}

function extractPotentialUnqualifiedColumns(sql: string): string[] {
  const candidates = new Set<string>();
  const selectAliases = extractSelectAliases(sql);
  const clauses = [
    sql.match(/\bselect\s+(.+?)\s+from\b/i)?.[1] ?? "",
    sql.match(/\bwhere\s+(.+?)(?=\s+group\s+by\b|\s+order\s+by\b|\s+limit\b|$)/i)?.[1] ?? "",
    sql.match(/\border\s+by\s+(.+?)(?=\s+limit\b|$)/i)?.[1] ?? "",
    sql.match(/\bgroup\s+by\s+(.+?)(?=\s+having\b|\s+order\s+by\b|\s+limit\b|$)/i)?.[1] ?? "",
    sql.match(/\bhaving\s+(.+?)(?=\s+order\s+by\b|\s+limit\b|$)/i)?.[1] ?? ""
  ];

  for (const rawClause of clauses) {
    const clause = rawClause.replace(/'([^']|'')*'/g, " ");
    for (const token of clause.matchAll(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g)) {
      const value = token[1];
      if (!value || reservedColumnToken(value)) {
        continue;
      }
      if (selectAliases.has(value.toLowerCase())) {
        continue;
      }
      const previousChar = clause[Math.max(0, (token.index ?? 0) - 1)];
      const nextChar = clause[(token.index ?? 0) + value.length];
      if (previousChar === "." || nextChar === ".") {
        continue;
      }
      candidates.add(value);
    }
  }

  return Array.from(candidates);
}

function extractSelectAliases(sql: string): Set<string> {
  const aliases = new Set<string>();
  const selectClause = sql.match(/\bselect\s+(.+?)\s+from\b/i)?.[1] ?? "";
  for (const match of selectClause.matchAll(/\bas\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi)) {
    if (match[1]) {
      aliases.add(match[1].toLowerCase());
    }
  }

  return aliases;
}

function reservedColumnToken(value: string): boolean {
  return [
    "select",
    "from",
    "where",
    "join",
    "on",
    "and",
    "or",
    "as",
    "count",
    "sum",
    "avg",
    "min",
    "max",
    "case",
    "when",
    "then",
    "else",
    "end",
    "asc",
    "desc",
    "date",
    "timestamp",
    "time",
    "interval",
    "null",
    "true",
    "false",
    "limit",
    "order",
    "group",
    "having",
    "by"
  ].includes(value.toLowerCase());
}

function cleanIdentifier(input: string): string {
  const parts = input
    .trim()
    .replace(/^["`\[]/, "")
    .replace(/["`\]]$/, "")
    .split(".");

  return (parts[parts.length - 1] ?? input).replace(/^["`\[]/, "").replace(/["`\]]$/, "");
}

function extractFragment(sql: string, phrase: string): string {
  const index = sql.toLowerCase().indexOf(phrase);
  if (index < 0) {
    return phrase;
  }

  return sql.slice(index, index + 80);
}

function firstWords(input: string, count: number): string {
  return input.trim().split(/\s+/).slice(0, count).join(" ");
}
