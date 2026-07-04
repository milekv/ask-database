# Security

ASK DATABASE v0.1.0 działa w trybie bezpiecznego generowania read-only SQL.

## Zgłaszanie problemów

Jeśli znajdziesz lukę bezpieczeństwa, zgłoś ją przez prywatne zgłoszenie bezpieczeństwa w GitHub, jeśli repozytorium ma włączoną tę funkcję. Nie publikuj szczegółów exploita w publicznym issue.

## Granice bezpieczeństwa

- Frontend nie przechowuje kluczy providerów.
- `.env` nie jest commitowany.
- Historyczne SQL-e są redagowane z literałów.
- Wersja 0.1.0 nie wykonuje SQL na produkcyjnych bazach.
- Safe Mode blokuje zapytania zapisu i destrukcyjne polecenia.
