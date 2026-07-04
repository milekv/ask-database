# Contributing

Dziękujemy za zainteresowanie ASK DATABASE.

## Zasady

- Zachowuj ścisłe typowanie TypeScript.
- Logika core, parsera, pamięci SQL i walidatora powinna mieć testy.
- Nie dodawaj kluczy, danych prywatnych ani lokalnych ścieżek.
- Teksty interfejsu powinny przechodzić przez i18n.
- Provider LLM nie może być wywoływany bezpośrednio z przeglądarki.
- Statyczne demo nie może udawać live backendu.

## Lokalny workflow

```bash
pnpm install
pnpm db:migrate
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```
