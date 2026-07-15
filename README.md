# Corvion Tool

Internes PSA-Tool für Corvion: Kundenakte mit Firmen, Ansprechpartnern, Verträgen (inkl. Kündigungsfristen-Überwachung) und Dokumentenablage. Stufe 2 bringt das Ticketsystem, Stufe 3 das Kundenportal.

## Setup

Voraussetzungen: Node 20+, Docker.

1. Repository klonen und `npm install`
2. `.env.example` nach `.env` kopieren und ausfüllen (`BETTER_AUTH_SECRET` mit `openssl rand -hex 32` erzeugen)
3. Datenbank starten: `docker compose up -d`, danach Test-DB anlegen:
   `docker compose exec db psql -U corvion -c 'CREATE DATABASE corvion_test;'`
4. Migrationen einspielen: `npm run db:migrate` (Test-DB: `DATABASE_URL=$TEST_DATABASE_URL npm run db:migrate`)
5. Ersten Admin anlegen: `npm run seed:admin`
6. Starten: `npm run dev` → http://localhost:5173

Beim ersten Login verlangt das Tool die Einrichtung der Zwei-Faktor-Authentifizierung (Authenticator-App).

## Entwicklung

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Dev-Server |
| `npm test` | Tests (brauchen laufende Test-DB) |
| `npm run check` | Typprüfung |
| `npm run db:generate` / `db:migrate` | Schema-Migrationen |
| `npm run db:studio` | Drizzle Studio (DB-GUI) |

Arbeitskonventionen stehen in [CLAUDE.md](CLAUDE.md), der Implementierungsplan in [docs/superpowers/plans/](docs/superpowers/plans/).
