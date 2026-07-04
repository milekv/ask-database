# Prywatność

ASK DATABASE zakłada, że schematy i historyczne SQL-e mogą być wrażliwe.

## Reguły

- Klucze providerów są wyłącznie po stronie backendu.
- Frontend nie zawiera żadnych wartości sekretów.
- Literały w historycznych SQL-ach są redagowane.
- Wersja demo używa wyłącznie syntetycznych danych.
- Wersja 0.1.0 nie wykonuje SQL na zewnętrznej bazie.
