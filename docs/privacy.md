# Prywatność

ASK DATABASE zakłada, że schematy i historyczne SQL-e mogą być wrażliwe.

## Reguły

- Klucze providerów są wyłącznie po stronie backendu.
- Frontend nie zawiera wartości sekretów.
- Historyczne SQL-e są redagowane przez zastąpienie literałów.
- Do providerów trafia ograniczony kontekst retrieval, a nie automatycznie cały workspace.
- Demo używa wyłącznie syntetycznych danych.
- ASK DATABASE nie wykonuje wygenerowanego SQL na produkcyjnej bazie.
- Safe Mode blokuje zapytania zapisu i destrukcyjne polecenia.
