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
      code: "single_statement",
      severity: "error",
      message: "Safe Mode dopuszcza dokladnie jedno polecenie SQL."
    });
  }

  const readOnly = /^(select|with)\b/i.test(normalized) && !destructiveKeywords.test(normalized);

  if (!readOnly) {
    issues.push({
      code: "read_only",
      severity: "error",
      message: "ASK DATABASE v0.1.0 generuje tylko zapytania odczytujace dane.",
      fragment: firstWords(normalized, 5)
    });
  }

  if (options.safeMode && /\bselect\s+\*/i.test(normalized)) {
    issues.push({
      code: "select_star",
      severity: "warning",
      message: "SELECT * utrudnia kontrole kolumn i moze zwiekszyc koszt zapytania.",
      fragment: "SELECT *"
    });
  }

  if (options.safeMode && /\border\s+by\b/i.test(normalized) && !/\blimit\b|\bfetch\s+first\b/i.test(normalized)) {
    issues.push({
      code: "unbounded_order",
      severity: "warning",
      message: "ORDER BY bez LIMIT moze wymusic sortowanie duzego wyniku.",
      fragment: extractFragment(normalized, "order by")
    });
  }

  const referencedTables = extractReferencedTables(normalized);
  const tableMap = new Map(schema.tables.map((table) => [table.name.toLowerCase(), table]));

  for (const table of referencedTables) {
    if (!tableMap.has(table.toLowerCase())) {
      issues.push({
        code: "unknown_table",
        severity: "error",
        message: `Tabela ${table} nie istnieje w aktywnym schemacie.`,
        fragment: table
      });
    }
  }

  for (const issue of validateQualifiedColumns(normalized, tableMap)) {
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

function extractReferencedTables(sql: string): string[] {
  const tables: string[] = [];
  const fromMatch = sql.match(/\bfrom\s+([a-zA-Z0-9_."`\[\]]+)/i);
  if (fromMatch?.[1]) {
    tables.push(cleanIdentifier(fromMatch[1]));
  }

  for (const match of sql.matchAll(/\bjoin\s+([a-zA-Z0-9_."`\[\]]+)/gi)) {
    if (match[1]) {
      tables.push(cleanIdentifier(match[1]));
    }
  }

  return Array.from(new Set(tables));
}

function validateQualifiedColumns(
  sql: string,
  tableMap: Map<string, TableDefinition>
): ValidationIssue[] {
  const aliases = extractAliases(sql);
  const issues: ValidationIssue[] = [];
  const qualifiedColumnPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)\b/g;

  for (const match of sql.matchAll(qualifiedColumnPattern)) {
    const alias = match[1];
    const column = match[2];
    if (!alias || !column) {
      continue;
    }

    const tableName = aliases.get(alias.toLowerCase()) ?? alias;
    const table = tableMap.get(tableName.toLowerCase());
    if (!table) {
      continue;
    }

    const hasColumn = table.columns.some(
      (definition) => definition.name.toLowerCase() === column.toLowerCase()
    );
    if (!hasColumn) {
      issues.push({
        code: "unknown_column",
        severity: "error",
        message: `Kolumna ${table.name}.${column} nie istnieje w aktywnym schemacie.`,
        fragment: `${alias}.${column}`
      });
    }
  }

  return issues;
}

function extractAliases(sql: string): Map<string, string> {
  const aliases = new Map<string, string>();
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

function reservedAlias(value: string): boolean {
  return ["where", "join", "left", "right", "full", "inner", "group", "order", "limit"].includes(
    value.toLowerCase()
  );
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
