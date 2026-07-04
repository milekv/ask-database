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
  safeMode: z.boolean()
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
