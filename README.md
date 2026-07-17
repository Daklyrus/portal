# Corvion Tool

PSA-Tool für Corvion: Kundenakte mit Firmen, Ansprechpartnern, Verträgen (inkl. Kündigungsfristen-Überwachung), Dokumentenablage, Ticketsystem mit E-Mail-Anbindung (Microsoft Graph, Shared Mailbox), SLA-Überwachung und Zeiterfassung — plus **Kundenportal** unter `/portal` (Anfragen stellen und verfolgen, Rechnungen aus lexoffice, freigegebene Verträge und Dokumente).

**Externe Anbindungen** (beide optional zuschaltbar):

- **Ticket-Mail-Sync:** einmalige App-Registrierung in Entra ID — Anleitung in [docs/entra-id-setup.md](docs/entra-id-setup.md). Ohne sie läuft alles außer Mailversand/-empfang (`TICKET_SYNC=off`).
- **Rechnungs-Sync:** lexoffice-API-Key (app.lexoffice.de → Extras → Public API) in `LEXOFFICE_API_KEY`, dann `LEXOFFICE_SYNC=on`. Zuordnung je Firma über das Feld „lexoffice-Kontakt-ID" in der Kundenakte.

**Portal-Zugänge:** In der Kundenakte am Ansprechpartner „Portal-Zugang einladen" — der Kontakt erhält per Mail einen 48 h gültigen Link zum Passwort-Setzen und meldet sich danach unter derselben Login-Seite an.

**Abrechnung:** Unter „Abrechnung" pro Monat und Firma Rechnungsentwürfe in lexoffice erzeugen (Vertragspauschalen + abrechenbare Zeiten × Stundensatz, netto + 19 %). Stundensatz: Standard auf der Abrechnungsseite, je Firma überschreibbar in der Akte. Abgerechnete Zeiten sind gesperrt; „Verwerfen" gibt sie frei (Entwurf in lexoffice dann manuell löschen). Festgeschrieben und versendet wird ausschließlich in lexoffice.

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

Arbeitskonventionen stehen in [CLAUDE.md](CLAUDE.md). **Projektstand, Roadmap und Übergabe-Doku: [docs/PROJEKT.md](docs/PROJEKT.md)** — der Implementierungsplan von Stufe 1 liegt in [docs/superpowers/plans/](docs/superpowers/plans/).

## Deployment (Hetzner-VPS o. ä.)

Der Produktions-Stack läuft komplett in Docker: App (Node), PostgreSQL 16 und Caddy als Reverse Proxy mit automatischem Let's-Encrypt-Zertifikat. Migrationen laufen bei jedem App-Start automatisch.

1. Server vorbereiten: Docker installieren, DNS-A-Record der Domain (z. B. `tool.corvion.de`) auf den Server zeigen lassen, Firewall nur 80/443 (und SSH) öffnen.
2. Repository auf den Server klonen.
3. `.env.production.example` nach `.env.production` kopieren und ausfüllen (Secrets mit `openssl rand -hex 32` erzeugen).
4. Starten:
   ```sh
   docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
   ```
5. Ersten Admin anlegen (einmalig):
   ```sh
   docker compose -f docker-compose.prod.yml --env-file .env.production exec app node scripts/seed-admin.mjs
   ```
6. Anmelden, 2FA einrichten, Seed-Passwort ändern.

**Update einspielen:** `git pull`, dann Befehl aus Schritt 4 erneut ausführen.

**Backups:** Die Daten liegen in den Docker-Volumes `corvion-prod_pgdata` (Datenbank) und `corvion-prod_uploads` (Dokumente). Beispiel für ein tägliches DB-Dump per Cron:

```sh
docker compose -f docker-compose.prod.yml --env-file .env.production exec -T db pg_dump -U corvion corvion | gzip > backup-$(date +%F).sql.gz
```

Dumps und eine Kopie des Upload-Volumes gehören auf ein anderes System (z. B. euer bestehendes Backup-Ziel).
