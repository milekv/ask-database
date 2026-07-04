# Architektura ASK DATABASE

ASK DATABASE składa się z aplikacji webowej, API oraz pakietów core.

## Warstwy

- `apps/web`: interfejs React, polski domyślny język, Monaco Editor, React Flow.
- `apps/api`: Fastify API i granica dla providerów.
- `packages/shared`: typy, schematy Zod, wspólne utilsy SQL.
- `packages/schema-parser`: deterministyczny parser DDL.
- `packages/sql-memory`: import historycznych SELECT-ów i uczenie wzorców.
- `packages/sql-validator`: Safe Mode i walidacja względem schematu.
- `packages/core`: workspace demo, health score, path finder i pipeline.
- `packages/ui`: współdzielone komponenty UI.

## Zasada projektowa

UI pokazuje wynik, ale nie trzyma logiki analizy. Logika znajduje się w pakietach, dzięki czemu można ją testować niezależnie od Reacta.
