import { z } from "zod";

export const questionInterpretationSchema = z.object({
  requestSummary: z.string(),
  requestedEntities: z.array(z.string()),
  requestedFields: z.array(z.string()),
  filters: z.array(z.string()),
  aggregations: z.array(z.string()),
  grouping: z.array(z.string()),
  sorting: z.array(z.string()),
  limit: z.number().nullable(),
  exclusions: z.array(z.string()),
  existenceConditions: z.array(z.string()),
  matchedBusinessTerms: z.array(z.string()),
  candidateTableIds: z.array(z.string()),
  candidateColumnIds: z.array(z.string()),
  ambiguities: z.array(z.string()),
  requiresClarification: z.boolean()
});

export type QuestionInterpretation = z.infer<typeof questionInterpretationSchema>;

export const generatedSqlDraftSchema = z.object({
  sql: z.string(),
  tableIdsUsed: z.array(z.string()),
  columnIdsUsed: z.array(z.string()),
  relationshipIdsUsed: z.array(z.string()),
  assumptions: z.array(z.string()),
  ambiguities: z.array(z.string()),
  explanation: z.string()
});

export type GeneratedSqlDraft = z.infer<typeof generatedSqlDraftSchema>;

export const correctionInterpretationSchema = z.object({
  rejectedTableIds: z.array(z.string()),
  requiredTableIds: z.array(z.string()),
  rejectedColumnIds: z.array(z.string()),
  requiredColumnIds: z.array(z.string()),
  preferredRelationshipIds: z.array(z.string()),
  rejectedRelationshipIds: z.array(z.string()),
  filterChanges: z.array(z.string()),
  meaningChanges: z.array(z.string()),
  memoryProposal: z
    .object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      appliesTo: z.enum(["relationship", "filter", "metric", "naming", "safety"]),
      confidence: z.number(),
      enabled: z.boolean(),
      priority: z.enum(["low", "medium", "high"]),
      scope: z.enum(["query", "conversation", "workspace"]),
      source: z.enum(["user-correction", "manual", "system"]),
      payload: z.record(z.unknown())
    })
    .nullable()
});

export type CorrectionInterpretation = z.infer<typeof correctionInterpretationSchema>;
