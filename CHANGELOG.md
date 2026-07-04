# Changelog

## 0.2.0 - ASK DATABASE v0.2.0: Real schema-aware generation pipeline

- Usunięto produkcyjny deterministic demo engine z `/api/ask`.
- Dodano trwałą persistencję workspace w PostgreSQL przez Drizzle.
- Dodano migracje, repozytorium i serwisy API.
- Dodano backendowy OpenAI provider oparty o Responses API i Structured Outputs.
- Rozdzielono prompt modules dla interpretacji pytania, generowania SQL, korekt i kontrolowanej regeneracji.
- Dodano schema retrieval, historical query retrieval i ranking relationship paths.
- Rozszerzono typy, Zod schemas i wynik `GenerationResult` o evidence, confidence, decision log i query version.
- Wzmocniono walidację SQL dla tabel, aliasów, kolumn, Safe Mode i destrukcyjnych poleceń.
- Dodano API CRUD dla workspace, glossary, aliasów i pamięci workspace.
- Dodano podstawowe tworzenie workspace w UI.
- Poprawiono statyczny tryb GitHub Pages: zapisane przykłady są jawnie oznaczone i nie udają live generowania.
- Zaktualizowano dokumentację PL/EN.

## 0.1.0

- Utworzono monorepo TypeScript dla ASK DATABASE.
- Dodano polski frontend React z demo workspace.
- Dodano API Fastify.
- Dodano parser DDL, pamięć SQL, walidator Safe Mode i początkowy core pipeline.
- Dodano testy pakietów, dokumentację, Docker Compose i CI.
