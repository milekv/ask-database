import cors from "@fastify/cors";
import Fastify from "fastify";
import { z } from "zod";
import {
  askRequestSchema,
  businessGlossaryTermInputSchema,
  correctionRequestSchema,
  createWorkspaceSchema,
  schemaAliasInputSchema,
  updateWorkspaceSchema,
  workspaceMemoryRuleInputSchema
} from "@ask-database/shared";

import { createDatabase } from "./db/client.js";
import { WorkspaceRepository } from "./repositories/workspace-repository.js";
import { AskService } from "./services/ask-service.js";
import { createLLMProviderFromEnv } from "./services/provider-factory.js";
import { WorkspaceService } from "./services/workspace-service.js";

export async function createServer() {
  const app = Fastify({
    logger: {
      redact: ["OPENAI_API_KEY", "headers.authorization", "body.apiKey"]
    }
  });

  const database = createDatabase();
  const repository = new WorkspaceRepository(database.db);
  const workspaceService = new WorkspaceService(repository);
  const provider = createLLMProviderFromEnv();
  const askService = new AskService(repository, provider);

  app.addHook("onClose", async () => {
    await database.pool.end();
  });

  app.register(cors, {
    origin: true
  });

  await workspaceService.seedUniversityDemo();

  app.get("/api/health", async () => {
    const providerHealth = await provider.healthCheck();
    return {
      ok: true,
      name: "ASK DATABASE API",
      version: "0.2.0",
      persistence: "postgresql",
      provider: providerHealth
    };
  });

  app.get("/api/workspaces", async () => ({
    workspaces: await workspaceService.listWorkspaces()
  }));

  app.post("/api/workspaces", async (request, reply) => {
    const parsed = createWorkspaceSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Nieprawidlowe dane workspace.",
        details: parsed.error.flatten()
      });
    }

    const result = await workspaceService.createWorkspace(parsed.data);
    return reply.status(201).send(result);
  });

  app.get("/api/workspaces/demo", async (request, reply) => {
    const workspace = await workspaceService.getWorkspace("university-demo");
    if (!workspace) {
      return reply.status(404).send({ error: "University Demo is not seeded." });
    }

    return { workspace };
  });

  app.get("/api/workspaces/:workspaceId", async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const workspace = await workspaceService.getWorkspace(workspaceId);
    if (!workspace) {
      return reply.status(404).send({ error: "Workspace nie istnieje." });
    }

    return { workspace };
  });

  app.patch("/api/workspaces/:workspaceId", async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const parsed = updateWorkspaceSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Nieprawidlowa aktualizacja workspace.",
        details: parsed.error.flatten()
      });
    }

    const updateInput = {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      ...(parsed.data.dialect !== undefined ? { dialect: parsed.data.dialect } : {})
    };
    const workspace = await workspaceService.updateWorkspace(workspaceId, updateInput);
    if (!workspace) {
      return reply.status(404).send({ error: "Workspace nie istnieje." });
    }

    return { workspace };
  });

  app.delete("/api/workspaces/:workspaceId", async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await workspaceService.deleteWorkspace(workspaceId);
    return reply.status(204).send();
  });

  app.post("/api/workspaces/:workspaceId/ask", async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const parsed = askRequestSchema.safeParse({
      ...(typeof request.body === "object" && request.body ? request.body : {}),
      workspaceId
    });
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Nieprawidlowe pytanie.",
        details: parsed.error.flatten()
      });
    }

    const response = await askService.ask(parsed.data);
    return reply.status(response.status).send(response.body);
  });

  app.post("/api/ask", async (request, reply) => {
    const parsed = askRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Nieprawidlowe pytanie.",
        details: parsed.error.flatten()
      });
    }

    const response = await askService.ask(parsed.data);
    return reply.status(response.status).send(response.body);
  });

  app.post("/api/workspaces/:workspaceId/glossary", async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const parsed = businessGlossaryTermInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Nieprawidlowy termin glossary.",
        details: parsed.error.flatten()
      });
    }

    const term = await workspaceService.addGlossaryTerm(workspaceId, parsed.data);
    return reply.status(201).send({ term });
  });

  app.patch("/api/workspaces/:workspaceId/glossary/:termId", async (request, reply) => {
    const { workspaceId, termId } = request.params as { workspaceId: string; termId: string };
    const parsed = businessGlossaryTermInputSchema.partial().safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Nieprawidlowa aktualizacja glossary.",
        details: parsed.error.flatten()
      });
    }

    const termPatch = {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.aliases !== undefined ? { aliases: parsed.data.aliases } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      ...(parsed.data.sqlExpression !== undefined ? { sqlExpression: parsed.data.sqlExpression } : {}),
      ...(parsed.data.relatedTables !== undefined ? { relatedTables: parsed.data.relatedTables } : {}),
      ...(parsed.data.relatedColumns !== undefined ? { relatedColumns: parsed.data.relatedColumns } : {}),
      ...(parsed.data.enabled !== undefined ? { enabled: parsed.data.enabled } : {})
    };
    const term = await workspaceService.updateGlossaryTerm(workspaceId, termId, termPatch);
    if (!term) {
      return reply.status(404).send({ error: "Termin nie istnieje." });
    }

    return { term };
  });

  app.delete("/api/workspaces/:workspaceId/glossary/:termId", async (request, reply) => {
    const { workspaceId, termId } = request.params as { workspaceId: string; termId: string };
    await workspaceService.deleteGlossaryTerm(workspaceId, termId);
    return reply.status(204).send();
  });

  app.post("/api/workspaces/:workspaceId/aliases", async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const parsed = schemaAliasInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Nieprawidlowy alias.",
        details: parsed.error.flatten()
      });
    }

    const alias = await workspaceService.addAlias(workspaceId, parsed.data);
    return reply.status(201).send({ alias });
  });

  app.patch("/api/workspaces/:workspaceId/aliases/:aliasId", async (request, reply) => {
    const { workspaceId, aliasId } = request.params as { workspaceId: string; aliasId: string };
    const parsed = schemaAliasInputSchema.partial().safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Nieprawidlowa aktualizacja aliasu.",
        details: parsed.error.flatten()
      });
    }

    const aliasPatch = {
      ...(parsed.data.targetType !== undefined ? { targetType: parsed.data.targetType } : {}),
      ...(parsed.data.targetId !== undefined ? { targetId: parsed.data.targetId } : {}),
      ...(parsed.data.alias !== undefined ? { alias: parsed.data.alias } : {}),
      ...(parsed.data.language !== undefined ? { language: parsed.data.language } : {}),
      ...(parsed.data.enabled !== undefined ? { enabled: parsed.data.enabled } : {})
    };
    const alias = await workspaceService.updateAlias(workspaceId, aliasId, aliasPatch);
    if (!alias) {
      return reply.status(404).send({ error: "Alias nie istnieje." });
    }

    return { alias };
  });

  app.delete("/api/workspaces/:workspaceId/aliases/:aliasId", async (request, reply) => {
    const { workspaceId, aliasId } = request.params as { workspaceId: string; aliasId: string };
    await workspaceService.deleteAlias(workspaceId, aliasId);
    return reply.status(204).send();
  });

  app.post("/api/workspaces/:workspaceId/memory", async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const parsed = workspaceMemoryRuleInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Nieprawidlowa reguła pamięci workspace.",
        details: parsed.error.flatten()
      });
    }

    const [memory] = await workspaceService.addMemoryRule(workspaceId, {
      ...parsed.data,
      id: ""
    });
    return reply.status(201).send({ memory });
  });

  app.patch("/api/workspaces/:workspaceId/memory/:memoryId", async (request, reply) => {
    const { workspaceId, memoryId } = request.params as { workspaceId: string; memoryId: string };
    const parsed = z.object({ enabled: z.boolean() }).safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Nieprawidlowa aktualizacja pamięci workspace.",
        details: parsed.error.flatten()
      });
    }

    await workspaceService.setMemoryEnabled(workspaceId, memoryId, parsed.data.enabled);
    return reply.status(204).send();
  });

  app.delete("/api/workspaces/:workspaceId/memory/:memoryId", async (request, reply) => {
    const { workspaceId, memoryId } = request.params as { workspaceId: string; memoryId: string };
    await workspaceService.deleteMemory(workspaceId, memoryId);
    return reply.status(204).send();
  });

  app.post(
    "/api/workspaces/:workspaceId/conversations/:conversationId/corrections",
    async (request, reply) => {
      const { workspaceId, conversationId } = request.params as {
        workspaceId: string;
        conversationId: string;
      };
      const parsed = correctionRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Nieprawidlowa korekta.",
          details: parsed.error.flatten()
        });
      }

      const response = await askService.correct(workspaceId, conversationId, parsed.data);
      return reply.status(response.status).send(response.body);
    }
  );

  return app;
}

const isDirectRun = process.argv[1]?.endsWith("server.js") || process.argv[1]?.endsWith("server.ts");

if (isDirectRun) {
  const app = await createServer();
  const port = Number(process.env.API_PORT ?? 4310);
  const host = process.env.API_HOST ?? "127.0.0.1";

  await app.listen({ port, host });
}
