import { parseDDL } from "@ask-database/schema-parser";
import type {
  BusinessTerm,
  CreateWorkspaceRequest,
  SchemaAlias,
  Workspace,
  WorkspaceImportSummary,
  WorkspaceMemoryRule
} from "@ask-database/shared";
import { importHistoricalQueries } from "@ask-database/sql-memory";
import {
  createUniversityDemoWorkspace,
  universityDemoDdl,
  universityHistoricalSql
} from "@ask-database/core";
import { WorkspaceRepository, type UpdateWorkspaceInput } from "../repositories/workspace-repository.js";

export class WorkspaceService {
  constructor(private readonly repository: WorkspaceRepository) {}

  async seedUniversityDemo(): Promise<void> {
    const existing = await this.repository.get("university-demo");
    if (existing) {
      return;
    }

    const demo = createUniversityDemoWorkspace();
    await this.repository.create({
      id: demo.id,
      name: demo.name,
      description: demo.description,
      dialect: demo.dialect,
      ddl: universityDemoDdl,
      parsedSchema: parseDDL(universityDemoDdl, demo.dialect),
      historicalImport: importHistoricalQueries(universityHistoricalSql, demo.dialect),
      glossary: demo.glossary,
      aliases: [
        {
          id: "alias_students_active",
          targetType: "column",
          targetId: "students.status",
          alias: "aktywny student",
          language: "pl",
          enabled: true
        }
      ],
      memoryRules: demo.memoryRules,
      corrections: demo.corrections
    });
  }

  listWorkspaces(): Promise<Workspace[]> {
    return this.repository.list();
  }

  async createWorkspace(input: CreateWorkspaceRequest): Promise<{
    workspace: Workspace;
    importSummary: WorkspaceImportSummary;
  }> {
    const parsedSchema = parseDDL(input.ddl, input.dialect);
    const historicalImport = importHistoricalQueries(input.historicalSql ?? "", input.dialect);
    const workspace = await this.repository.create({
      name: input.name,
      description: input.description ?? "",
      dialect: input.dialect,
      ddl: input.ddl,
      parsedSchema,
      historicalImport
    });

    return {
      workspace,
      importSummary: buildImportSummary(parsedSchema, historicalImport.imported)
    };
  }

  getWorkspace(id: string): Promise<Workspace | null> {
    return this.repository.get(id);
  }

  updateWorkspace(id: string, input: UpdateWorkspaceInput): Promise<Workspace | null> {
    return this.repository.update(id, input);
  }

  deleteWorkspace(id: string): Promise<void> {
    return this.repository.delete(id);
  }

  async addGlossaryTerm(workspaceId: string, term: Omit<BusinessTerm, "id">): Promise<BusinessTerm> {
    const [created] = await this.repository.addGlossaryTerms(workspaceId, [
      {
        ...term,
        id: ""
      }
    ]);
    if (!created) {
      throw new Error("Glossary term was not created.");
    }

    return created;
  }

  updateGlossaryTerm(
    workspaceId: string,
    termId: string,
    term: Partial<BusinessTerm>
  ): Promise<BusinessTerm | null> {
    return this.repository.updateGlossaryTerm(workspaceId, termId, term);
  }

  deleteGlossaryTerm(workspaceId: string, termId: string): Promise<void> {
    return this.repository.deleteGlossaryTerm(workspaceId, termId);
  }

  async addAlias(workspaceId: string, alias: Omit<SchemaAlias, "id">): Promise<SchemaAlias> {
    const [created] = await this.repository.addAliases(workspaceId, [
      {
        ...alias,
        id: ""
      }
    ]);
    if (!created) {
      throw new Error("Alias was not created.");
    }

    return created;
  }

  updateAlias(
    workspaceId: string,
    aliasId: string,
    alias: Partial<SchemaAlias>
  ): Promise<SchemaAlias | null> {
    return this.repository.updateAlias(workspaceId, aliasId, alias);
  }

  deleteAlias(workspaceId: string, aliasId: string): Promise<void> {
    return this.repository.deleteAlias(workspaceId, aliasId);
  }

  addMemoryRule(workspaceId: string, memory: WorkspaceMemoryRule): Promise<WorkspaceMemoryRule[]> {
    return this.repository.addMemoryRules(workspaceId, [memory]);
  }

  setMemoryEnabled(workspaceId: string, memoryId: string, enabled: boolean): Promise<void> {
    return this.repository.setMemoryEnabled(workspaceId, memoryId, enabled);
  }

  deleteMemory(workspaceId: string, memoryId: string): Promise<void> {
    return this.repository.deleteMemory(workspaceId, memoryId);
  }
}

function buildImportSummary(
  parsedSchema: ReturnType<typeof parseDDL>,
  historicalQueries: ReturnType<typeof importHistoricalQueries>["imported"]
): WorkspaceImportSummary {
  const uniqueTables = new Set(historicalQueries.flatMap((query) => query.tables));
  return {
    tables: parsedSchema.schema.tables.length,
    columns: parsedSchema.schema.tables.reduce((sum, table) => sum + table.columns.length, 0),
    relationships: parsedSchema.schema.relationships.length,
    warnings: parsedSchema.warnings,
    unsupportedStatements: parsedSchema.skippedStatements,
    historicalQueries: historicalQueries.length,
    uniqueHistoricalTables: uniqueTables.size,
    joinPatterns: historicalQueries.reduce((sum, query) => sum + query.joins.length, 0),
    filterPatterns: historicalQueries.reduce((sum, query) => sum + query.filters.length, 0),
    aggregationPatterns: historicalQueries.filter((query) => query.groupBy.length > 0).length
  };
}
