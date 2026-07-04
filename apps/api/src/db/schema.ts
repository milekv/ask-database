import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp
} from "drizzle-orm/pg-core";

export const workspaces = pgTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  dialect: text("dialect").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const schemaVersions = pgTable("schema_versions", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  version: text("version").notNull(),
  ddl: text("ddl").notNull(),
  warnings: jsonb("warnings").notNull().default([]),
  unsupportedStatements: jsonb("unsupported_statements").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const schemaTables = pgTable("schema_tables", {
  id: text("id").primaryKey(),
  schemaVersionId: text("schema_version_id").notNull(),
  workspaceId: text("workspace_id").notNull(),
  name: text("name").notNull(),
  schemaName: text("schema_name"),
  primaryKey: jsonb("primary_key").notNull().default([]),
  uniqueKeys: jsonb("unique_keys").notNull().default([]),
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const schemaColumns = pgTable("schema_columns", {
  id: text("id").primaryKey(),
  tableId: text("table_id").notNull(),
  schemaVersionId: text("schema_version_id").notNull(),
  workspaceId: text("workspace_id").notNull(),
  tableName: text("table_name").notNull(),
  name: text("name").notNull(),
  dataType: text("data_type").notNull(),
  nullable: boolean("nullable").notNull(),
  primaryKey: boolean("primary_key").notNull(),
  uniqueKey: boolean("unique_key").notNull(),
  defaultValue: text("default_value"),
  referencesTable: text("references_table"),
  referencesColumn: text("references_column"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const schemaRelationships = pgTable("schema_relationships", {
  id: text("id").primaryKey(),
  schemaVersionId: text("schema_version_id").notNull(),
  workspaceId: text("workspace_id").notNull(),
  fromTable: text("from_table").notNull(),
  fromColumn: text("from_column").notNull(),
  toTable: text("to_table").notNull(),
  toColumn: text("to_column").notNull(),
  source: text("source").notNull(),
  confidence: numeric("confidence").notNull().default("1"),
  enabled: boolean("enabled").notNull().default(true),
  preferred: boolean("preferred").notNull().default(false),
  rejected: boolean("rejected").notNull().default(false),
  usageCount: integer("usage_count").notNull().default(0),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const historicalQueries = pgTable("historical_queries", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  originalSql: text("original_sql").notNull(),
  sanitizedSql: text("sanitized_sql").notNull(),
  normalizedSql: text("normalized_sql").notNull(),
  statementType: text("statement_type").notNull(),
  tables: jsonb("tables").notNull().default([]),
  columns: jsonb("columns").notNull().default([]),
  joins: jsonb("joins").notNull().default([]),
  filters: jsonb("filters").notNull().default([]),
  groupBy: jsonb("group_by").notNull().default([]),
  orderBy: jsonb("order_by").notNull().default([]),
  structureSignature: text("structure_signature").notNull(),
  semanticSummary: text("semantic_summary"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const businessGlossaryTerms = pgTable("business_glossary_terms", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  name: text("name").notNull(),
  aliases: jsonb("aliases").notNull().default([]),
  description: text("description").notNull().default(""),
  sqlExpression: text("sql_expression"),
  relatedTables: jsonb("related_tables").notNull().default([]),
  relatedColumns: jsonb("related_columns").notNull().default([]),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const schemaAliases = pgTable("schema_aliases", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  alias: text("alias").notNull(),
  language: text("language"),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const workspaceMemory = pgTable("workspace_memory", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  appliesTo: text("applies_to").notNull(),
  confidence: numeric("confidence").notNull().default("1"),
  enabled: boolean("enabled").notNull().default(true),
  priority: text("priority").notNull().default("medium"),
  scope: text("scope").notNull().default("workspace"),
  source: text("source").notNull().default("manual"),
  payload: jsonb("payload").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const workspaceCorrections = pgTable("workspace_corrections", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  originalQuestion: text("original_question").notNull(),
  correctedSql: text("corrected_sql").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const queryConversations = pgTable("query_conversations", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const queryTurns = pgTable("query_turns", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull(),
  role: text("role").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const queryVersions = pgTable("query_versions", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull(),
  workspaceId: text("workspace_id").notNull(),
  versionNumber: integer("version_number").notNull(),
  question: text("question").notNull(),
  interpretation: text("interpretation").notNull(),
  sql: text("sql").notNull(),
  validation: jsonb("validation").notNull(),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const decisionLogEntries = pgTable("decision_log_entries", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  conversationId: text("conversation_id"),
  queryVersionId: text("query_version_id"),
  stage: text("stage").notNull(),
  message: text("message").notNull(),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
