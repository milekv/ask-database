import type {
  ColumnDefinition,
  DatabaseSchema,
  RelationshipDefinition,
  SchemaParseResult,
  SqlDialect,
  TableDefinition
} from "@ask-database/shared";
import { splitSqlStatements } from "@ask-database/shared";

interface ParsedTableName {
  schemaName?: string;
  tableName: string;
}

const statementStarters = /^(create\s+table|alter\s+table)\b/i;

export function parseDDL(input: string, dialect: SqlDialect): SchemaParseResult {
  const statements = splitSqlStatements(input);
  const tables = new Map<string, TableDefinition>();
  const relationships: RelationshipDefinition[] = [];
  const warnings: string[] = [];
  const skippedStatements: string[] = [];

  for (const statement of statements) {
    const normalized = statement.trim().replace(/;$/, "");
    if (normalized.length === 0) {
      continue;
    }

    if (!statementStarters.test(normalized)) {
      skippedStatements.push(normalized);
      warnings.push(`Pominieto nieobslugiwane polecenie: ${firstWords(normalized, 4)}`);
      continue;
    }

    if (/^create\s+table\b/i.test(normalized)) {
      const parsed = parseCreateTable(normalized);
      if (!parsed) {
        skippedStatements.push(normalized);
        warnings.push(`Nie udalo sie sparsowac CREATE TABLE: ${firstWords(normalized, 5)}`);
        continue;
      }

      tables.set(parsed.table.name, parsed.table);
      relationships.push(...parsed.relationships);
      warnings.push(...parsed.warnings);
      continue;
    }

    const parsedRelationship = parseAlterTableForeignKey(normalized);
    if (!parsedRelationship) {
      skippedStatements.push(normalized);
      warnings.push(`Nie udalo sie sparsowac ALTER TABLE: ${firstWords(normalized, 5)}`);
      continue;
    }

    relationships.push(parsedRelationship);
  }

  const schema: DatabaseSchema = {
    dialect,
    version: "v1",
    tables: Array.from(tables.values()),
    relationships: deduplicateRelationships(relationships),
    warnings
  };

  return {
    schema,
    skippedStatements,
    warnings
  };
}

function parseCreateTable(statement: string): {
  table: TableDefinition;
  relationships: RelationshipDefinition[];
  warnings: string[];
} | null {
  const match = statement.match(
    /^create\s+table\s+(?:if\s+not\s+exists\s+)?(.+?)\s*\(([\s\S]+)\)$/i
  );
  if (!match) {
    return null;
  }

  const parsedName = parseQualifiedName(match[1] ?? "");
  const body = match[2] ?? "";
  const tableName = parsedName.tableName;
  const columns: ColumnDefinition[] = [];
  const primaryKey = new Set<string>();
  const uniqueKeys: string[][] = [];
  const relationships: RelationshipDefinition[] = [];
  const warnings: string[] = [];

  for (const entry of splitTopLevelComma(body)) {
    const trimmed = entry.trim();
    if (trimmed.length === 0) {
      continue;
    }

    if (/^(constraint\s+\S+\s+)?primary\s+key\b/i.test(trimmed)) {
      for (const column of parseColumnList(trimmed)) {
        primaryKey.add(column);
      }
      continue;
    }

    if (/^(constraint\s+\S+\s+)?unique\b/i.test(trimmed)) {
      const columnsInKey = parseColumnList(trimmed);
      if (columnsInKey.length > 0) {
        uniqueKeys.push(columnsInKey);
      }
      continue;
    }

    if (/^(constraint\s+\S+\s+)?foreign\s+key\b/i.test(trimmed)) {
      const relationship = parseForeignKeyConstraint(trimmed, tableName);
      if (relationship) {
        relationships.push(relationship);
      } else {
        warnings.push(`Nie rozpoznano relacji w tabeli ${tableName}: ${trimmed}`);
      }
      continue;
    }

    const column = parseColumnDefinition(trimmed);
    if (!column) {
      warnings.push(`Nie rozpoznano kolumny w tabeli ${tableName}: ${trimmed}`);
      continue;
    }

    if (column.primaryKey) {
      primaryKey.add(column.name);
    }

    if (column.unique) {
      uniqueKeys.push([column.name]);
    }

    if (column.references) {
      relationships.push({
        id: relationshipId(tableName, column.name, column.references.table, column.references.column),
        fromTable: tableName,
        fromColumn: column.name,
        toTable: column.references.table,
        toColumn: column.references.column,
        confidence: 1,
        source: "ddl",
        description: `Relacja z definicji kolumny ${tableName}.${column.name}`
      });
    }

    columns.push(column);
  }

  const table: TableDefinition = {
    name: tableName,
    columns,
    primaryKey: Array.from(primaryKey),
    uniqueKeys
  };

  if (parsedName.schemaName) {
    table.schemaName = parsedName.schemaName;
  }

  return {
    table,
    relationships,
    warnings
  };
}

function parseAlterTableForeignKey(statement: string): RelationshipDefinition | null {
  const match = statement.match(
    /^alter\s+table\s+(.+?)\s+add\s+(?:constraint\s+\S+\s+)?foreign\s+key\s*\(([^)]+)\)\s+references\s+(.+?)\s*\(([^)]+)\)/i
  );
  if (!match) {
    return null;
  }

  const fromTable = parseQualifiedName(match[1] ?? "").tableName;
  const fromColumn = unquoteIdentifier((match[2] ?? "").split(",")[0] ?? "");
  const toTable = parseQualifiedName(match[3] ?? "").tableName;
  const toColumn = unquoteIdentifier((match[4] ?? "").split(",")[0] ?? "");

  return {
    id: relationshipId(fromTable, fromColumn, toTable, toColumn),
    fromTable,
    fromColumn,
    toTable,
    toColumn,
    confidence: 1,
    source: "ddl",
    description: `Relacja z ALTER TABLE ${fromTable}.${fromColumn}`
  };
}

function parseForeignKeyConstraint(entry: string, tableName: string): RelationshipDefinition | null {
  const match = entry.match(
    /foreign\s+key\s*\(([^)]+)\)\s+references\s+(.+?)\s*\(([^)]+)\)/i
  );
  if (!match) {
    return null;
  }

  const fromColumn = unquoteIdentifier((match[1] ?? "").split(",")[0] ?? "");
  const toTable = parseQualifiedName(match[2] ?? "").tableName;
  const toColumn = unquoteIdentifier((match[3] ?? "").split(",")[0] ?? "");

  return {
    id: relationshipId(tableName, fromColumn, toTable, toColumn),
    fromTable: tableName,
    fromColumn,
    toTable,
    toColumn,
    confidence: 1,
    source: "ddl",
    description: `Relacja z ograniczenia FOREIGN KEY ${tableName}.${fromColumn}`
  };
}

function parseColumnDefinition(entry: string): ColumnDefinition | null {
  const nameMatch = entry.match(/^("[^"]+"|`[^`]+`|\[[^\]]+\]|\S+)\s+(.+)$/);
  if (!nameMatch) {
    return null;
  }

  const name = unquoteIdentifier(nameMatch[1] ?? "");
  const rest = nameMatch[2] ?? "";
  const constraintMatch = rest.search(
    /\b(not\s+null|null|primary\s+key|unique|default|references|constraint|check|collate)\b/i
  );
  const dataType = (constraintMatch >= 0 ? rest.slice(0, constraintMatch) : rest).trim();
  const inlineReference = rest.match(/references\s+(.+?)\s*\(([^)]+)\)/i);
  const defaultMatch = rest.match(
    /\bdefault\s+(.+?)(?=\s+\b(?:not\s+null|null|primary\s+key|unique|references|check|constraint)\b|$)/i
  );

  const column: ColumnDefinition = {
    name,
    dataType,
    nullable: !/\bnot\s+null\b/i.test(rest) && !/\bprimary\s+key\b/i.test(rest),
    primaryKey: /\bprimary\s+key\b/i.test(rest),
    unique: /\bunique\b/i.test(rest)
  };

  if (defaultMatch?.[1]) {
    column.defaultValue = defaultMatch[1].trim();
  }

  if (inlineReference) {
    column.references = {
      table: parseQualifiedName(inlineReference[1] ?? "").tableName,
      column: unquoteIdentifier((inlineReference[2] ?? "").split(",")[0] ?? "")
    };
  }

  return column;
}

function splitTopLevelComma(input: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  let quote: "'" | "\"" | "`" | null = null;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index] ?? "";

    if ((char === "'" || char === "\"" || char === "`") && !quote) {
      quote = char;
      current += char;
      continue;
    }

    if (quote === char) {
      quote = null;
      current += char;
      continue;
    }

    if (!quote && char === "(") {
      depth += 1;
    }

    if (!quote && char === ")") {
      depth = Math.max(0, depth - 1);
    }

    if (!quote && depth === 0 && char === ",") {
      parts.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim().length > 0) {
    parts.push(current);
  }

  return parts;
}

function parseColumnList(input: string): string[] {
  const match = input.match(/\(([^)]+)\)/);
  if (!match) {
    return [];
  }

  return (match[1] ?? "")
    .split(",")
    .map((column) => unquoteIdentifier(column))
    .filter(Boolean);
}

function parseQualifiedName(input: string): ParsedTableName {
  const cleaned = input.trim().replace(/\s+$/g, "");
  const parts = cleaned.split(".").map((part) => unquoteIdentifier(part));
  if (parts.length > 1) {
    return {
      schemaName: parts.slice(0, -1).join("."),
      tableName: parts[parts.length - 1] ?? cleaned
    };
  }

  return {
    tableName: unquoteIdentifier(cleaned)
  };
}

function unquoteIdentifier(input: string): string {
  return input.trim().replace(/^["`\[]/, "").replace(/["`\]]$/, "");
}

function relationshipId(
  fromTable: string,
  fromColumn: string,
  toTable: string,
  toColumn: string
): string {
  return `${fromTable}.${fromColumn}->${toTable}.${toColumn}`.toLowerCase();
}

function deduplicateRelationships(
  relationships: RelationshipDefinition[]
): RelationshipDefinition[] {
  const byId = new Map<string, RelationshipDefinition>();
  for (const relationship of relationships) {
    byId.set(relationship.id, relationship);
  }

  return Array.from(byId.values());
}

function firstWords(input: string, count: number): string {
  return input.split(/\s+/).slice(0, count).join(" ");
}
