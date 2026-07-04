# Contributing

Dziękujemy za zainteresowanie ASK DATABASE.

## Zasady

- Zachowuj ścisłe typowanie TypeScript.
- Logika core, parsera, pamięci SQL i walidatora musi mieć testy.
- Nie dodawaj kluczy, danych prywatnych ani lokalnych ścieżek.
- Teksty interfejsu powinny przechodzić przez i18n.
- Provider LLM nie może być wywoływany bezpośrednio z przeglądarki.

## Lokalny workflow

```bash
pnpm install
pnpm build
pnpm test
pnpm lint:repo
```
