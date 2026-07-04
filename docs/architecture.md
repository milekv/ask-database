# Architektura ASK DATABASE

ASK DATABASE składa się z aplikacji webowej, API i pakietów domenowych. UI pokazuje stan produktu, ale core logic, parsery, retrieval i walidacja są w pakietach testowalnych poza Reactem.

## Warstwy

- `apps/web`: React, Vite, Tailwind, Monaco Editor, React Flow, statyczny tryb GitHub Pages.
- `apps/api`: Fastify API, Drizzle, migracje, repozytoria, serwisy i provider factory.
- `packages/shared`: typy, schematy Zod i wspólne utilsy SQL.
- `packages/schema-parser`: parser DDL.
- `packages/sql-memory`: import i analiza historycznych SELECT-ów.
- `packages/sql-validator`: Safe Mode i walidacja schematu.
- `packages/core`: prompt modules, retrieval, relationship path ranking i ask pipeline.
- `packages/ui`: współdzielone komponenty React.

## Pipeline

```mermaid
flowchart TD
  Q["Pytanie użytkownika"] --> R["Schema retrieval"]
  R --> H["Historical query retrieval"]
  H --> P["Relationship path ranking"]
  P --> I["Structured interpretation"]
  I --> G["Structured SQL generation"]
  G --> V["SQL validation / Safe Mode"]
  V --> C{"Valid?"}
  C -->|tak| O["Result + evidence + query version"]
  C -->|nie| X["Controlled regeneration max 2"]
  X --> V
```

## Zasada bezpieczeństwa

Provider działa wyłącznie po stronie backendu. Frontend nie zna `OPENAI_API_KEY`, nie przechowuje sekretów i w statycznym trybie nie udaje live generowania.
