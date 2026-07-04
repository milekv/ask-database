# Security

ASK DATABASE generuje SQL, ale go nie wykonuje. Wynik przechodzi przez Safe Mode i walidację schematu przed pokazaniem użytkownikowi.

## Zgłaszanie problemów

Jeśli znajdziesz lukę bezpieczeństwa, zgłoś ją przez prywatne zgłoszenie bezpieczeństwa w GitHub, jeśli repozytorium ma włączoną tę funkcję. Nie publikuj szczegółów exploita w publicznym issue.

## Granice bezpieczeństwa

- Frontend nie przechowuje kluczy providerów.
- `.env` nie jest commitowany.
- `OPENAI_API_KEY` jest używany tylko przez backend.
- Historyczne SQL-e są redagowane z literałów.
- Safe Mode blokuje zapytania zapisu i destrukcyjne polecenia.
- Błędy providera są normalizowane przed zwróceniem do frontendu.
