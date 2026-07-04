export type Language = "pl" | "en";

export type SqlDialect =
  | "postgresql"
  | "mysql"
  | "sqlite"
  | "sqlserver"
  | "oracle";

export type ConstraintKind = "primary-key" | "foreign-key" | "unique" | "check";

export interface ColumnDefinition {
  name: string;
  dataType: string;
  nullable: boolean;
  primaryKey: boolean;
  unique: boolean;
  defaultValue?: string;
  references?: ColumnReference;
}

export interface ColumnReference {
  table: string;
  column: string;
}

export interface TableDefinition {
  name: string;
  schemaName?: string;
  columns: ColumnDefinition[];
  primaryKey: string[];
  uniqueKeys: string[][];
  comment?: string;
}

export interface RelationshipDefinition {
  id: string;
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  confidence: number;
  source: "ddl" | "historical-query" | "manual";
  description?: string;
}

export interface DatabaseSchema {
  dialect: SqlDialect;
  version: string;
  tables: TableDefinition[];
  relationships: RelationshipDefinition[];
  warnings: string[];
}

export interface SchemaParseResult {
  schema: DatabaseSchema;
  skippedStatements: string[];
  warnings: string[];
}

export interface HistoricalQuery {
  id: string;
  originalSql: string;
  redactedSql: string;
  statementType: "select" | "with";
  tables: string[];
  joins: JoinPattern[];
  filters: FilterPattern[];
  groupBy: string[];
  orderBy: string[];
  signature: string;
}

export interface JoinPattern {
  leftTable?: string;
  leftColumn?: string;
  rightTable?: string;
  rightColumn?: string;
  rawCondition: string;
  joinType: "inner" | "left" | "right" | "full" | "cross" | "unknown";
}

export interface FilterPattern {
  column?: string;
  operator?: string;
  value?: string;
  rawCondition: string;
}

export interface QueryPattern {
  id: string;
  title: string;
  description: string;
  tables: string[];
  relationships: string[];
  confidence: number;
  examples: string[];
}

export interface BusinessTerm {
  id: string;
  name: string;
  aliases: string[];
  description: string;
  sqlExpression?: string;
  relatedTables: string[];
  relatedColumns: string[];
}

export interface WorkspaceMemoryRule {
  id: string;
  title: string;
  description: string;
  appliesTo: "relationship" | "filter" | "metric" | "naming" | "safety";
  confidence: number;
}

export interface CorrectionMemory {
  id: string;
  originalQuestion: string;
  correctedSql: string;
  reason: string;
  createdAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  description: string;
  dialect: SqlDialect;
  schema: DatabaseSchema;
  historicalQueries: HistoricalQuery[];
  queryPatterns: QueryPattern[];
  glossary: BusinessTerm[];
  memoryRules: WorkspaceMemoryRule[];
  corrections: CorrectionMemory[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceHealth {
  score: number;
  schemaCoverage: number;
  relationshipCoverage: number;
  memoryCoverage: number;
  glossaryCoverage: number;
  blockers: string[];
  recommendations: string[];
}

export interface ValidationIssue {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
  fragment?: string;
}

export interface ValidationResult {
  valid: boolean;
  readOnly: boolean;
  issues: ValidationIssue[];
}

export interface GenerationEvidence {
  label: string;
  description: string;
  confidence: number;
  source: "schema" | "history" | "glossary" | "memory" | "validation";
}

export interface GenerationResult {
  question: string;
  interpretation: string;
  sql: string;
  dialect: SqlDialect;
  relationshipPath: RelationshipDefinition[];
  evidence: GenerationEvidence[];
  validation: ValidationResult;
  generatedAt: string;
  engine: "deterministic-demo" | "llm-provider";
}

export interface AskRequest {
  workspaceId: string;
  question: string;
  dialect: SqlDialect;
  safeMode: boolean;
}
