import type {
  FilterPattern,
  HistoricalQuery,
  JoinPattern,
  SqlDialect
} from "@ask-database/shared";
import { normalizeSql, splitSqlStatements } from "@ask-database/shared";

export interface HistoricalSqlImportResult {
  imported: HistoricalQuery[];
  skipped: string[];
  warnings: string[];
}

export function importHistoricalQueries(
  sql: string,
  dialect: SqlDialect
): HistoricalSqlImportResult {
  const imported: HistoricalQuery[] = [];
  const skipped: string[] = [];
  const warnings: string[] = [];

  for (const statement of splitSqlStatements(sql)) {
    const normalized = normalizeSql(statement);
    if (!/^(select|with)\b/i.test(normalized)) {
      skipped.push(statement);
      warnings.push(`Pominieto polecenie inne niz SELECT/WITH: ${firstWords(statement, 4)}`);
      continue;
    }

    imported.push(analyzeHistoricalQuery(statement, dialect));
  }

  return {
    imported,
    skipped,
    warnings
  };
}

export function analyzeHistoricalQuery(sql: string, dialect: SqlDialect): HistoricalQuery {
  const normalized = normalizeSql(sql);
  const redactedSql = redactSqlLiterals(normalized);
  const statementType = /^with\b/i.test(normalized) ? "with" : "select";
  const tables = extractTables(normalized);
  const joins = extractJoins(normalized);
  const filters = extractFilters(normalized);

  return {
    id: `query_${stableHash(redactedSql)}`,
    originalSql: sql.trim(),
    redactedSql,
    statementType,
    tables,
    joins,
    filters,
    groupBy: extractClauseColumns(normalized, "group by"),
    orderBy: extractClauseColumns(normalized, "order by"),
    signature: `${dialect}_${stableHash(redactedSql)}`
  };
}

export function redactSqlLiterals(sql: string): string {
  return sql
    .replace(/'([^']|'')*'/g, "?")
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, "?")
    .replace(/\b\d+(?:\.\d+)?\b/g, "?");
}

export function learnQueryPatterns(queries: HistoricalQuery[]) {
  const byTables = new Map<string, HistoricalQuery[]>();

  for (const query of queries) {
    const key = [...query.tables].sort().join("|");
    if (key.length === 0) {
      continue;
    }

    byTables.set(key, [...(byTables.get(key) ?? []), query]);
  }

  return Array.from(byTables.entries()).map(([key, grouped], index) => {
    const tables = key.split("|");
    const relationships = grouped.flatMap((query) =>
      query.joins.map((join) => join.rawCondition)
    );

    return {
      id: `pattern_${index + 1}_${stableHash(key)}`,
      title: `Wzorzec zapytan: ${tables.join(" + ")}`,
      description: `Wykryto ${grouped.length} historyczne zapytanie/zapytania korzystajace z tych samych tabel.`,
      tables,
      relationships: unique(relationships),
      confidence: Math.min(0.95, 0.45 + grouped.length * 0.15),
      examples: grouped.slice(0, 3).map((query) => query.redactedSql)
    };
  });
}

function extractTables(sql: string): string[] {
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

  return unique(tables);
}

function extractJoins(sql: string): JoinPattern[] {
  const joins: JoinPattern[] = [];
  const joinPattern =
    /\b((?:left|right|full|cross|inner)\s+)?join\s+([a-zA-Z0-9_."`\[\]]+)(?:\s+[a-zA-Z0-9_]+)?\s+on\s+(.+?)(?=\s+(?:left|right|full|cross|inner)?\s*join\b|\s+where\b|\s+group\s+by\b|\s+order\s+by\b|\s+limit\b|$)/gi;

  for (const match of sql.matchAll(joinPattern)) {
    const joinType = normalizeJoinType(match[1] ?? "");
    const rawCondition = (match[3] ?? "").trim();
    const columns = rawCondition.match(
      /([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\s*=\s*([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)/
    );

    const join: JoinPattern = {
      rawCondition,
      joinType
    };

    if (columns?.[1] && columns[2] && columns[3] && columns[4]) {
      join.leftTable = columns[1];
      join.leftColumn = columns[2];
      join.rightTable = columns[3];
      join.rightColumn = columns[4];
    }

    joins.push(join);
  }

  return joins;
}

function extractFilters(sql: string): FilterPattern[] {
  const whereMatch = sql.match(
    /\bwhere\s+(.+?)(?=\s+group\s+by\b|\s+order\s+by\b|\s+limit\b|$)/i
  );
  if (!whereMatch?.[1]) {
    return [];
  }

  return whereMatch[1]
    .split(/\s+and\s+/i)
    .map((condition): FilterPattern => {
      const trimmed = condition.trim();
      const parsed = trimmed.match(/([a-zA-Z0-9_.]+)\s*(=|<>|!=|>=|<=|>|<|like|in)\s*(.+)/i);
      if (!parsed?.[1] || !parsed[2] || !parsed[3]) {
        return {
          rawCondition: trimmed
        };
      }

      return {
        column: parsed[1],
        operator: parsed[2].toUpperCase(),
        value: parsed[3],
        rawCondition: trimmed
      };
    });
}

function extractClauseColumns(sql: string, clause: "group by" | "order by"): string[] {
  const pattern = new RegExp(
    `\\b${clause}\\s+(.+?)(?=\\s+limit\\b|\\s+offset\\b|$)`,
    "i"
  );
  const match = sql.match(pattern);
  if (!match?.[1]) {
    return [];
  }

  return match[1]
    .split(",")
    .map((column) => column.trim().replace(/\s+(asc|desc)$/i, ""))
    .filter(Boolean);
}

function normalizeJoinType(input: string): JoinPattern["joinType"] {
  const normalized = input.trim().toLowerCase();
  if (normalized.startsWith("left")) {
    return "left";
  }
  if (normalized.startsWith("right")) {
    return "right";
  }
  if (normalized.startsWith("full")) {
    return "full";
  }
  if (normalized.startsWith("cross")) {
    return "cross";
  }
  if (normalized.startsWith("inner") || normalized.length === 0) {
    return "inner";
  }

  return "unknown";
}

function cleanIdentifier(input: string): string {
  const parts = input
    .trim()
    .replace(/^["`\[]/, "")
    .replace(/["`\]]$/, "")
    .split(".");

  return (parts[parts.length - 1] ?? input).replace(/^["`\[]/, "").replace(/["`\]]$/, "");
}

function firstWords(input: string, count: number): string {
  return input.trim().split(/\s+/).slice(0, count).join(" ");
}

function stableHash(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }

  return (hash >>> 0).toString(16);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}
