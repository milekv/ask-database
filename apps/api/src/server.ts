import cors from "@fastify/cors";
import Fastify from "fastify";
import {
  calculateWorkspaceHealth,
  createUniversityDemoWorkspace,
  DisabledLLMProvider,
  generateReadOnlySql
} from "@ask-database/core";
import { askRequestSchema } from "@ask-database/shared";

export function createServer() {
  const app = Fastify({
    logger: true
  });
  const workspace = createUniversityDemoWorkspace();
  const provider = new DisabledLLMProvider();

  app.register(cors, {
    origin: true
  });

  app.get("/api/health", async () => {
    const providerHealth = await provider.healthCheck();
    return {
      ok: true,
      name: "ASK DATABASE API",
      version: "0.1.0",
      provider: providerHealth
    };
  });

  app.get("/api/workspaces/demo", async () => ({
    workspace,
    health: calculateWorkspaceHealth(workspace)
  }));

  app.post("/api/ask", async (request, reply) => {
    const parsed = askRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Nieprawidlowe wejscie",
        details: parsed.error.flatten()
      });
    }

    if (parsed.data.workspaceId !== workspace.id) {
      return reply.status(404).send({
        error: "Workspace nie istnieje"
      });
    }

    const result = generateReadOnlySql({
      workspace,
      question: parsed.data.question,
      safeMode: parsed.data.safeMode
    });

    return {
      result
    };
  });

  return app;
}

const isDirectRun = process.argv[1]?.endsWith("server.js") || process.argv[1]?.endsWith("server.ts");

if (isDirectRun) {
  const app = createServer();
  const port = Number(process.env.API_PORT ?? 4310);
  const host = process.env.API_HOST ?? "127.0.0.1";

  await app.listen({ port, host });
}
