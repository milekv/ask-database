import { and, desc, eq } from "drizzle-orm";
import type {
  BusinessTerm,
  CorrectionMemory,
  DatabaseSchema,
  HistoricalQuery,
  QueryConversation,
  QueryTurn,
  QueryVersion,
  SchemaAlias,
  SchemaParseResult,
  SqlDialect,
  Workspace,
  WorkspaceMemoryRule
} from "@ask-database/shared";
import type { HistoricalSqlImportResult } from "@ask-database/sql-memory";

import type { Database } from "../db/client.js";
import {
  businessGlossaryTerms,
  decisionLogEntries,
  historicalQueries,
  queryConversations,
  queryTurns,
  queryVersions,
  schemaAliases,
  schemaColumns,
  schemaRelationships,
  schemaTables,
  schemaVersions,
  workspaceCorrections,
  workspaceMemory,
  workspaces
} from "../db/schema.js";

export interface PersistWorkspaceInput {
  id?: string;
  name: string;
  description: string;
  dialect: SqlDialect;
  ddl: string;
  parsedSchema: SchemaParseResult;
  historicalImport: HistoricalSqlImportResult;
  glossary?: BusinessTerm[];
  aliases?: SchemaAlias[];
  memoryRules?: WorkspaceMemoryRule[];
  corrections?: CorrectionMemory[];
}

export interface UpdateWorkspaceInput {
  name?: string | undefined;
  description?: string | undefined;
  dialect?: SqlDialect | undefined;
}

export class WorkspaceRepository {
  constructor(private readonly db: Database) {}

  async list(): Promise<Workspace[]> {
    const rows = await this.db.select().from(workspaces).orderBy(desc(workspaces.updatedAt));
    const loaded = await Promise.all(rows.map((row) => this.get(row.id)));
    return loaded.filter((workspace): workspace is Workspace => Boolean(workspace));
  }

  async get(id: string): Promise<Workspace | null> {
    const workspaceRows = await this.db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1);
    const workspaceRow = workspaceRows[0];
    if (!workspaceRow) {
      return null;
    }

    const schemaVersionRows = await this.db
      .select()
      .from(schemaVersions)
      .where(eq(schemaVersions.workspaceId, id))
      .orderBy(desc(schemaVersions.createdAt))
      .limit(1);
    const schemaVersion = schemaVersionRows[0];

    const [
      tableRows,
      columnRows,
      relationshipRows,
      historicalRows,
      glossaryRows,
      aliasRows,
      memoryRows,
      correctionRows
    ] = await Promise.all([
      schemaVersion
        ? this.db.select().from(schemaTables).where(eq(schemaTables.schemaVersionId, schemaVersion.id))
        : [],
      schemaVersion
        ? this.db.select().from(schemaColumns).where(eq(schemaColumns.schemaVersionId, schemaVersion.id))
        : [],
      schemaVersion
        ? this.db
            .select()
            .from(schemaRelationships)
            .where(eq(schemaRelationships.schemaVersionId, schemaVersion.id))
        : [],
      this.db.select().from(historicalQueries).where(eq(historicalQueries.workspaceId, id)),
      this.db.select().from(businessGlossaryTerms).where(eq(businessGlossaryTerms.workspaceId, id)),
      this.db.select().from(schemaAliases).where(eq(schemaAliases.workspaceId, id)),
      this.db.select().from(workspaceMemory).where(eq(workspaceMemory.workspaceId, id)),
      this.db.select().from(workspaceCorrections).where(eq(workspaceCorrections.workspaceId, id))
    ]);

    const schema: DatabaseSchema = {
      dialect: workspaceRow.dialect as SqlDialect,
      version: schemaVersion?.version ?? "v1",
      warnings: asStringArray(schemaVersion?.warnings),
      tables: tableRows.map((table) => ({
        name: table.name,
        ...(table.schemaName ? { schemaName: table.schemaName } : {}),
        primaryKey: asStringArray(table.primaryKey),
        uniqueKeys: asStringMatrix(table.uniqueKeys),
        ...(table.comment ? { comment: table.comment } : {}),
        columns: columnRows
          .filter((column) => column.tableId === table.id)
          .map((column) => ({
            name: column.name,
            dataType: column.dataType,
            nullable: column.nullable,
            primaryKey: column.primaryKey,
            unique: column.uniqueKey,
            ...(column.defaultValue ? { defaultValue: column.defaultValue } : {}),
            ...(column.referencesTable && column.referencesColumn
              ? {
                  references: {
                    table: column.referencesTable,
                    column: column.referencesColumn
                  }
                }
              : {})
          }))
      })),
      relationships: relationshipRows.map((relationship) => ({
        id: relationship.id,
        fromTable: relationship.fromTable,
        fromColumn: relationship.fromColumn,
        toTable: relationship.toTable,
        toColumn: relationship.toColumn,
        confidence: Number(relationship.confidence),
        source: relationship.source as DatabaseSchema["relationships"][number]["source"],
        enabled: relationship.enabled,
        preferred: relationship.preferred,
        rejected: relationship.rejected,
        usageCount: relationship.usageCount,
        ...(relationship.description ? { description: relationship.description } : {})
      }))
    };

    return {
      id: workspaceRow.id,
      name: workspaceRow.name,
      description: workspaceRow.description,
      dialect: workspaceRow.dialect as SqlDialect,
      schema,
      historicalQueries: historicalRows.map((query) => ({
        id: query.id,
        originalSql: query.originalSql,
        redactedSql: query.sanitizedSql,
        normalizedSql: query.normalizedSql,
        statementType: query.statementType as HistoricalQuery["statementType"],
        tables: asStringArray(query.tables),
        columns: asStringArray(query.columns),
        joins: Array.isArray(query.joins) ? (query.joins as HistoricalQuery["joins"]) : [],
        filters: Array.isArray(query.filters) ? (query.filters as HistoricalQuery["filters"]) : [],
        groupBy: asStringArray(query.groupBy),
        orderBy: asStringArray(query.orderBy),
        signature: query.structureSignature,
        ...(query.semanticSummary ? { semanticSummary: query.semanticSummary } : {})
      })),
      queryPatterns: [],
      glossary: glossaryRows.map((term) => ({
        id: term.id,
        name: term.name,
        aliases: asStringArray(term.aliases),
        description: term.description,
        ...(term.sqlExpression ? { sqlExpression: term.sqlExpression } : {}),
        relatedTables: asStringArray(term.relatedTables),
        relatedColumns: asStringArray(term.relatedColumns),
        enabled: term.enabled
      })),
      aliases: aliasRows.map((alias) => ({
        id: alias.id,
        targetType: alias.targetType as SchemaAlias["targetType"],
        targetId: alias.targetId,
        alias: alias.alias,
        ...(alias.language ? { language: alias.language as SchemaAlias["language"] } : {}),
        enabled: alias.enabled
      })),
      memoryRules: memoryRows.map((memory) => ({
        id: memory.id,
        title: memory.title,
        description: memory.description,
        appliesTo: memory.appliesTo as WorkspaceMemoryRule["appliesTo"],
        confidence: Number(memory.confidence),
        enabled: memory.enabled,
        priority: memory.priority as WorkspaceMemoryRule["priority"],
        scope: memory.scope as WorkspaceMemoryRule["scope"],
        source: memory.source as WorkspaceMemoryRule["source"],
        payload: isRecord(memory.payload) ? memory.payload : {}
      })),
      corrections: correctionRows.map((correction) => ({
        id: correction.id,
        originalQuestion: correction.originalQuestion,
        correctedSql: correction.correctedSql,
        reason: correction.reason,
        createdAt: correction.createdAt.toISOString()
      })),
      createdAt: workspaceRow.createdAt.toISOString(),
      updatedAt: workspaceRow.updatedAt.toISOString()
    };
  }

  async create(input: PersistWorkspaceInput): Promise<Workspace> {
    const workspaceId = input.id ?? randomId("workspace");
    const schemaVersionId = randomId("schema");
    const now = new Date();

    await this.db.insert(workspaces).values({
      id: workspaceId,
      name: input.name,
      description: input.description,
      dialect: input.dialect,
      createdAt: now,
      updatedAt: now
    });

    await this.db.insert(schemaVersions).values({
      id: schemaVersionId,
      workspaceId,
      version: input.parsedSchema.schema.version,
      ddl: input.ddl,
      warnings: input.parsedSchema.warnings,
      unsupportedStatements: input.parsedSchema.skippedStatements
    });

    for (const table of input.parsedSchema.schema.tables) {
      const tableId = tableIdFor(workspaceId, schemaVersionId, table.name);
      await this.db.insert(schemaTables).values({
        id: tableId,
        workspaceId,
        schemaVersionId,
        name: table.name,
        schemaName: table.schemaName ?? null,
        primaryKey: table.primaryKey,
        uniqueKeys: table.uniqueKeys,
        comment: table.comment ?? null
      });

      for (const column of table.columns) {
        await this.db.insert(schemaColumns).values({
          id: columnIdFor(workspaceId, schemaVersionId, table.name, column.name),
          tableId,
          workspaceId,
          schemaVersionId,
          tableName: table.name,
          name: column.name,
          dataType: column.dataType,
          nullable: column.nullable,
          primaryKey: column.primaryKey,
          uniqueKey: column.unique,
          defaultValue: column.defaultValue ?? null,
          referencesTable: column.references?.table ?? null,
          referencesColumn: column.references?.column ?? null
        });
      }
    }

    for (const relationship of input.parsedSchema.schema.relationships) {
      await this.db.insert(schemaRelationships).values({
        id: relationship.id,
        schemaVersionId,
        workspaceId,
        fromTable: relationship.fromTable,
        fromColumn: relationship.fromColumn,
        toTable: relationship.toTable,
        toColumn: relationship.toColumn,
        source: relationship.source,
        confidence: String(relationship.confidence),
        enabled: relationship.enabled ?? true,
        preferred: relationship.preferred ?? false,
        rejected: relationship.rejected ?? false,
        usageCount: relationship.usageCount ?? 0,
        description: relationship.description ?? null
      });
    }

    await this.addHistoricalQueries(workspaceId, input.historicalImport.imported);
    await this.addGlossaryTerms(workspaceId, input.glossary ?? []);
    await this.addAliases(workspaceId, input.aliases ?? []);
    await this.addMemoryRules(workspaceId, input.memoryRules ?? []);
    await this.addCorrections(workspaceId, input.corrections ?? []);

    const created = await this.get(workspaceId);
    if (!created) {
      throw new Error("Workspace was not persisted.");
    }

    return created;
  }

  async update(id: string, input: UpdateWorkspaceInput): Promise<Workspace | null> {
    await this.db
      .update(workspaces)
      .set({
        ...(input.name ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.dialect ? { dialect: input.dialect } : {}),
        updatedAt: new Date()
      })
      .where(eq(workspaces.id, id));

    return this.get(id);
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(workspaces).where(eq(workspaces.id, id));
  }

  async addHistoricalQueries(workspaceId: string, queries: HistoricalQuery[]): Promise<void> {
    for (const query of queries) {
      await this.db
        .insert(historicalQueries)
        .values({
          id: query.id,
          workspaceId,
          originalSql: query.originalSql,
          sanitizedSql: query.redactedSql,
          normalizedSql: query.normalizedSql ?? query.redactedSql,
          statementType: query.statementType,
          tables: query.tables,
          columns: query.columns ?? [],
          joins: query.joins,
          filters: query.filters,
          groupBy: query.groupBy,
          orderBy: query.orderBy,
          structureSignature: query.signature,
          semanticSummary: query.semanticSummary ?? null
        })
        .onConflictDoNothing();
    }
  }

  async addGlossaryTerms(workspaceId: string, terms: BusinessTerm[]): Promise<BusinessTerm[]> {
    const created: BusinessTerm[] = [];
    for (const term of terms) {
      const id = term.id || randomId("term");
      await this.db.insert(businessGlossaryTerms).values({
        id,
        workspaceId,
        name: term.name,
        aliases: term.aliases,
        description: term.description,
        sqlExpression: term.sqlExpression ?? null,
        relatedTables: term.relatedTables,
        relatedColumns: term.relatedColumns,
        enabled: term.enabled ?? true
      });
      created.push({ ...term, id, enabled: term.enabled ?? true });
    }

    return created;
  }

  async updateGlossaryTerm(
    workspaceId: string,
    termId: string,
    term: Partial<BusinessTerm>
  ): Promise<BusinessTerm | null> {
    await this.db
      .update(businessGlossaryTerms)
      .set({
        ...(term.name ? { name: term.name } : {}),
        ...(term.aliases ? { aliases: term.aliases } : {}),
        ...(term.description !== undefined ? { description: term.description } : {}),
        ...(term.sqlExpression !== undefined ? { sqlExpression: term.sqlExpression ?? null } : {}),
        ...(term.relatedTables ? { relatedTables: term.relatedTables } : {}),
        ...(term.relatedColumns ? { relatedColumns: term.relatedColumns } : {}),
        ...(term.enabled !== undefined ? { enabled: term.enabled } : {}),
        updatedAt: new Date()
      })
      .where(and(eq(businessGlossaryTerms.workspaceId, workspaceId), eq(businessGlossaryTerms.id, termId)));

    return (await this.get(workspaceId))?.glossary.find((item) => item.id === termId) ?? null;
  }

  async deleteGlossaryTerm(workspaceId: string, termId: string): Promise<void> {
    await this.db
      .delete(businessGlossaryTerms)
      .where(and(eq(businessGlossaryTerms.workspaceId, workspaceId), eq(businessGlossaryTerms.id, termId)));
  }

  async addAliases(workspaceId: string, aliases: SchemaAlias[]): Promise<SchemaAlias[]> {
    const created: SchemaAlias[] = [];
    for (const alias of aliases) {
      const id = alias.id || randomId("alias");
      await this.db.insert(schemaAliases).values({
        id,
        workspaceId,
        targetType: alias.targetType,
        targetId: alias.targetId,
        alias: alias.alias,
        language: alias.language ?? null,
        enabled: alias.enabled
      });
      created.push({ ...alias, id });
    }

    return created;
  }

  async updateAlias(
    workspaceId: string,
    aliasId: string,
    alias: Partial<SchemaAlias>
  ): Promise<SchemaAlias | null> {
    await this.db
      .update(schemaAliases)
      .set({
        ...(alias.targetType !== undefined ? { targetType: alias.targetType } : {}),
        ...(alias.targetId !== undefined ? { targetId: alias.targetId } : {}),
        ...(alias.alias !== undefined ? { alias: alias.alias } : {}),
        ...(alias.language !== undefined ? { language: alias.language ?? null } : {}),
        ...(alias.enabled !== undefined ? { enabled: alias.enabled } : {}),
        updatedAt: new Date()
      })
      .where(and(eq(schemaAliases.workspaceId, workspaceId), eq(schemaAliases.id, aliasId)));

    return (await this.get(workspaceId))?.aliases?.find((item) => item.id === aliasId) ?? null;
  }

  async deleteAlias(workspaceId: string, aliasId: string): Promise<void> {
    await this.db
      .delete(schemaAliases)
      .where(and(eq(schemaAliases.workspaceId, workspaceId), eq(schemaAliases.id, aliasId)));
  }

  async addMemoryRules(workspaceId: string, rules: WorkspaceMemoryRule[]): Promise<WorkspaceMemoryRule[]> {
    const created: WorkspaceMemoryRule[] = [];
    for (const rule of rules) {
      const id = rule.id || randomId("memory");
      await this.db.insert(workspaceMemory).values({
        id,
        workspaceId,
        title: rule.title,
        description: rule.description,
        appliesTo: rule.appliesTo,
        confidence: String(rule.confidence),
        enabled: rule.enabled ?? true,
        priority: rule.priority ?? "medium",
        scope: rule.scope ?? "workspace",
        source: rule.source ?? "manual",
        payload: rule.payload ?? {}
      });
      created.push({ ...rule, id, enabled: rule.enabled ?? true });
    }

    return created;
  }

  async setMemoryEnabled(workspaceId: string, memoryId: string, enabled: boolean): Promise<void> {
    await this.db
      .update(workspaceMemory)
      .set({ enabled, updatedAt: new Date() })
      .where(and(eq(workspaceMemory.workspaceId, workspaceId), eq(workspaceMemory.id, memoryId)));
  }

  async deleteMemory(workspaceId: string, memoryId: string): Promise<void> {
    await this.db
      .delete(workspaceMemory)
      .where(and(eq(workspaceMemory.workspaceId, workspaceId), eq(workspaceMemory.id, memoryId)));
  }

  async addCorrections(workspaceId: string, corrections: CorrectionMemory[]): Promise<void> {
    for (const correction of corrections) {
      await this.db.insert(workspaceCorrections).values({
        id: correction.id || randomId("correction"),
        workspaceId,
        originalQuestion: correction.originalQuestion,
        correctedSql: correction.correctedSql,
        reason: correction.reason,
        createdAt: new Date(correction.createdAt)
      });
    }
  }

  async createConversation(workspaceId: string, title: string): Promise<QueryConversation> {
    const id = randomId("conversation");
    const now = new Date();
    await this.db.insert(queryConversations).values({
      id,
      workspaceId,
      title,
      createdAt: now,
      updatedAt: now
    });

    return {
      id,
      workspaceId,
      title,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };
  }

  async getConversation(id: string): Promise<QueryConversation | null> {
    const rows = await this.db.select().from(queryConversations).where(eq(queryConversations.id, id)).limit(1);
    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      workspaceId: row.workspaceId,
      title: row.title,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }

  async listTurns(conversationId: string): Promise<QueryTurn[]> {
    const rows = await this.db.select().from(queryTurns).where(eq(queryTurns.conversationId, conversationId));
    return rows.map((row) => ({
      id: row.id,
      conversationId: row.conversationId,
      role: row.role as QueryTurn["role"],
      message: row.message,
      createdAt: row.createdAt.toISOString()
    }));
  }

  async addTurn(conversationId: string, role: QueryTurn["role"], message: string): Promise<QueryTurn> {
    const id = randomId("turn");
    const now = new Date();
    await this.db.insert(queryTurns).values({
      id,
      conversationId,
      role,
      message,
      createdAt: now
    });

    return {
      id,
      conversationId,
      role,
      message,
      createdAt: now.toISOString()
    };
  }

  async createQueryVersion(input: {
    workspaceId: string;
    conversationId: string;
    question: string;
    interpretation: string;
    sql: string;
    validation: unknown;
    metadata?: Record<string, unknown>;
  }): Promise<QueryVersion> {
    const previous = await this.db
      .select()
      .from(queryVersions)
      .where(eq(queryVersions.conversationId, input.conversationId))
      .orderBy(desc(queryVersions.versionNumber))
      .limit(1);
    const versionNumber = (previous[0]?.versionNumber ?? 0) + 1;
    const id = randomId("version");
    const now = new Date();

    await this.db.insert(queryVersions).values({
      id,
      workspaceId: input.workspaceId,
      conversationId: input.conversationId,
      versionNumber,
      question: input.question,
      interpretation: input.interpretation,
      sql: input.sql,
      validation: input.validation,
      metadata: input.metadata ?? {},
      createdAt: now
    });

    return {
      id,
      conversationId: input.conversationId,
      versionNumber,
      question: input.question,
      interpretation: input.interpretation,
      sql: input.sql,
      createdAt: now.toISOString()
    };
  }

  async getLatestQueryVersion(conversationId: string): Promise<QueryVersion | null> {
    const rows = await this.db
      .select()
      .from(queryVersions)
      .where(eq(queryVersions.conversationId, conversationId))
      .orderBy(desc(queryVersions.versionNumber))
      .limit(1);
    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      conversationId: row.conversationId,
      versionNumber: row.versionNumber,
      question: row.question,
      interpretation: row.interpretation,
      sql: row.sql,
      createdAt: row.createdAt.toISOString()
    };
  }
}

export function randomId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function tableIdFor(workspaceId: string, schemaVersionId: string, tableName: string): string {
  return `${workspaceId}_${schemaVersionId}_table_${tableName}`.toLowerCase().replace(/[^a-z0-9_]+/g, "_");
}

function columnIdFor(
  workspaceId: string,
  schemaVersionId: string,
  tableName: string,
  columnName: string
): string {
  return `${workspaceId}_${schemaVersionId}_column_${tableName}_${columnName}`
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_");
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asStringMatrix(value: unknown): string[][] {
  return Array.isArray(value)
    ? value
        .filter(Array.isArray)
        .map((items) => items.filter((item): item is string => typeof item === "string"))
    : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
