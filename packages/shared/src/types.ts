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
  defaultValue?: string | undefined;
  references?: ColumnReference | undefined;
}

export interface ColumnReference {
  table: string;
  column: string;
}

export interface TableDefinition {
  name: string;
  schemaName?: string | undefined;
  columns: ColumnDefinition[];
  primaryKey: string[];
  uniqueKeys: string[][];
  comment?: string | undefined;
}

export interface RelationshipDefinition {
  id: string;
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  confidence: number;
  source:
    | "ddl"
    | "historical-query"
    | "manual"
    | "user-correction"
    | "approved-memory"
    | "inferred";
  description?: string | undefined;
  enabled?: boolean | undefined;
  preferred?: boolean | undefined;
  rejected?: boolean | undefined;
  usageCount?: number | undefined;
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
  normalizedSql?: string | undefined;
  statementType: "select" | "with";
  tables: string[];
  columns?: string[] | undefined;
  joins: JoinPattern[];
  filters: FilterPattern[];
  groupBy: string[];
  orderBy: string[];
  signature: string;
  semanticSummary?: string | undefined;
}

export interface JoinPattern {
  leftTable?: string | undefined;
  leftColumn?: string | undefined;
  rightTable?: string | undefined;
  rightColumn?: string | undefined;
  rawCondition: string;
  joinType: "inner" | "left" | "right" | "full" | "cross" | "unknown";
}

export interface FilterPattern {
  column?: string | undefined;
  operator?: string | undefined;
  value?: string | undefined;
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
  sqlExpression?: string | undefined;
  relatedTables: string[];
  relatedColumns: string[];
  enabled?: boolean | undefined;
}

export interface SchemaAlias {
  id: string;
  targetType: "table" | "column" | "relationship";
  targetId: string;
  alias: string;
  language?: Language | undefined;
  enabled: boolean;
}

export interface WorkspaceMemoryRule {
  id: string;
  title: string;
  description: string;
  appliesTo: "relationship" | "filter" | "metric" | "naming" | "safety";
  confidence: number;
  enabled?: boolean | undefined;
  priority?: "low" | "medium" | "high" | undefined;
  scope?: "query" | "conversation" | "workspace" | undefined;
  source?: "user-correction" | "manual" | "system" | undefined;
  payload?: Record<string, unknown> | undefined;
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
  aliases?: SchemaAlias[] | undefined;
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
  fragment?: string | undefined;
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
  source:
    | "schema"
    | "history"
    | "glossary"
    | "alias"
    | "relationship"
    | "memory"
    | "validation"
    | "provider";
}

export interface GenerationResult {
  question: string;
  interpretation: string;
  sql: string;
  dialect: SqlDialect;
  relationshipPath: RelationshipDefinition[];
  alternativePaths?: RelationshipPathCandidate[] | undefined;
  schemaSelection?: SchemaRetrievalResult | undefined;
  historicalEvidence?: HistoricalQueryMatch[] | undefined;
  businessTermEvidence?: BusinessTerm[] | undefined;
  workspaceMemoryEvidence?: WorkspaceMemoryRule[] | undefined;
  evidence: GenerationEvidence[];
  confidence?: number | undefined;
  validation: ValidationResult;
  ambiguities?: string[] | undefined;
  assumptions?: string[] | undefined;
  queryVersion?: QueryVersion | undefined;
  decisionLog?: DecisionLogEntry[] | undefined;
  generatedAt: string;
  engine: "provider:openai" | "provider:disabled" | "mock:test" | "saved-example";
}

export interface AskRequest {
  workspaceId: string;
  question: string;
  dialect: SqlDialect;
  safeMode: boolean;
  conversationId?: string | undefined;
  previousQueryVersionId?: string | undefined;
  overrides?: ManualOverride[] | undefined;
}

export interface CreateWorkspaceRequest {
  name: string;
  description?: string | undefined;
  dialect: SqlDialect;
  ddl: string;
  historicalSql?: string | undefined;
}

export interface UpdateWorkspaceRequest {
  name?: string | undefined;
  description?: string | undefined;
  dialect?: SqlDialect | undefined;
}

export interface WorkspaceImportSummary {
  tables: number;
  columns: number;
  relationships: number;
  warnings: string[];
  unsupportedStatements: string[];
  historicalQueries: number;
  uniqueHistoricalTables: number;
  joinPatterns: number;
  filterPatterns: number;
  aggregationPatterns: number;
}

export interface RetrievalEvidence {
  source: "table-name" | "column-name" | "alias" | "glossary" | "history" | "memory";
  targetId: string;
  label: string;
  score: number;
  reason: string;
}

export interface SchemaCandidateTable {
  table: TableDefinition;
  score: number;
  evidence: RetrievalEvidence[];
}

export interface SchemaCandidateColumn {
  tableName: string;
  column: ColumnDefinition;
  score: number;
  evidence: RetrievalEvidence[];
}

export interface SchemaRetrievalResult {
  candidateTables: SchemaCandidateTable[];
  candidateColumns: SchemaCandidateColumn[];
  matchedAliases: SchemaAlias[];
  matchedBusinessTerms: BusinessTerm[];
  retrievalEvidence: RetrievalEvidence[];
  retrievalScore: number;
}

export interface HistoricalQueryMatch {
  query: HistoricalQuery;
  score: number;
  evidence: RetrievalEvidence[];
}

export interface RelationshipPathCandidate {
  relationships: RelationshipDefinition[];
  tables: string[];
  score: number;
  evidence: RetrievalEvidence[];
  ambiguousWith?: string[] | undefined;
}

export interface DecisionLogEntry {
  id: string;
  stage: string;
  message: string;
  metadata?: Record<string, unknown> | undefined;
  createdAt: string;
}

export interface QueryConversation {
  id: string;
  workspaceId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface QueryTurn {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  message: string;
  createdAt: string;
}

export interface QueryVersion {
  id: string;
  conversationId: string;
  versionNumber: number;
  question: string;
  sql: string;
  interpretation: string;
  createdAt: string;
}

export interface ManualOverride {
  type: "table" | "column" | "relationship";
  fromId: string;
  toId: string;
}

export interface CorrectionRequest {
  message: string;
  persistScope?: "query" | "conversation" | "workspace" | undefined;
}

export interface CorrectionInterpretation {
  rejectedTableIds: string[];
  requiredTableIds: string[];
  rejectedColumnIds: string[];
  requiredColumnIds: string[];
  preferredRelationshipIds: string[];
  rejectedRelationshipIds: string[];
  filterChanges: string[];
  meaningChanges: string[];
  memoryProposal: WorkspaceMemoryRule | null;
}

export interface CorrectionResult {
  correctionInterpretation: CorrectionInterpretation;
  changesApplied: string[];
  previousSql: string;
  newSql: string;
  validation: ValidationResult;
  memoryProposal?: WorkspaceMemoryRule | undefined;
  result: GenerationResult;
}
