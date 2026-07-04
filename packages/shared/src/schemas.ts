import { z } from "zod";

export const languageSchema = z.enum(["pl", "en"]);

export const sqlDialectSchema = z.enum([
  "postgresql",
  "mysql",
  "sqlite",
  "sqlserver",
  "oracle"
]);

export const askRequestSchema = z.object({
  workspaceId: z.string().min(1),
  question: z.string().min(3),
  dialect: sqlDialectSchema,
  safeMode: z.boolean(),
  conversationId: z.string().optional(),
  previousQueryVersionId: z.string().optional(),
  overrides: z
    .array(
      z.object({
        type: z.enum(["table", "column", "relationship"]),
        fromId: z.string(),
        toId: z.string()
      })
    )
    .optional()
});

export const createWorkspaceSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  dialect: sqlDialectSchema,
  ddl: z.string().min(10),
  historicalSql: z.string().optional()
});

export const updateWorkspaceSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  dialect: sqlDialectSchema.optional()
});

export const businessGlossaryTermInputSchema = z.object({
  name: z.string().min(2),
  aliases: z.array(z.string().min(1)).default([]),
  description: z.string().default(""),
  sqlExpression: z.string().optional(),
  relatedTables: z.array(z.string()).default([]),
  relatedColumns: z.array(z.string()).default([]),
  enabled: z.boolean().default(true)
});

export const schemaAliasInputSchema = z.object({
  targetType: z.enum(["table", "column", "relationship"]),
  targetId: z.string().min(1),
  alias: z.string().min(1),
  language: languageSchema.optional(),
  enabled: z.boolean().default(true)
});

export const workspaceMemoryRuleInputSchema = z.object({
  title: z.string().min(2),
  description: z.string().min(2),
  appliesTo: z.enum(["relationship", "filter", "metric", "naming", "safety"]),
  confidence: z.number().min(0).max(1).default(1),
  enabled: z.boolean().default(true),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  scope: z.enum(["query", "conversation", "workspace"]).default("workspace"),
  source: z.enum(["user-correction", "manual", "system"]).default("manual"),
  payload: z.record(z.unknown()).default({})
});

export const correctionRequestSchema = z.object({
  message: z.string().min(3),
  persistScope: z.enum(["query", "conversation", "workspace"]).default("query")
});

export const validationIssueSchema = z.object({
  code: z.string(),
  severity: z.enum(["error", "warning", "info"]),
  message: z.string(),
  fragment: z.string().optional()
});

export const validationResultSchema = z.object({
  valid: z.boolean(),
  readOnly: z.boolean(),
  issues: z.array(validationIssueSchema)
});
