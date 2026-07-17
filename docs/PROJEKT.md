# Corvion Tool — Projektstand & Roadmap

Dieses Dokument ist die Übergabe-Quelle für die Weiterarbeit — egal ob auf einem anderen Rechner, mit einer frischen Claude-Session oder nach längerer Pause. Es hält fest, was gebaut ist, was als Nächstes kommt und welche Entscheidungen dahinterstehen. **Bei Weiterarbeit mit Claude: dieses Dokument zu Beginn der Session nennen.**

Stand: 16.07.2026

## Worum es geht

Corvion (corvion.de) ist ein MSP (UG) in Herzebrock-Clarholz und betreut KMU in OWL. Das Tool ist ein **internes PSA-System** (CRM + Tickets + Kundenportal) für einen Mandanten — kein verkaufbares Produkt. Treiber: Kosten, Datenhoheit, Automatisierung, Ownership.

Rahmenbedingungen:

- 1–3 interne Nutzer (Rollen: Admin, Techniker), später Kunden im Portal
- < 30 Kundenfirmen, kein Altsystem zu migrieren
- Ist-Zustand vorher: Support über Outlook/M365, Rechnungen in lexoffice, Kundendaten in Excel
- Betrieb: Docker auf deutschem VPS (Hetzner), deutsche UI, DSGVO-bewusst (keine externen CDNs)

## Stufenplan

| Stufe | Inhalt | Status |
| --- | --- | --- |
| 1 | Kundenakte: Firmen, Kontakte, Verträge mit Fristen, Dokumente | ✅ fertig (16.07.2026) |
| — | Produktions-Deployment (Docker + Caddy) | ✅ gebaut, Go-Live offen |
| 2 | Ticketsystem: E-Mail via Microsoft Graph, Zeiterfassung | ⬜ als Nächstes |
| 3 | Kundenportal: Tickets, Rechnungen aus lexoffice, freigegebene Dokumente | ⬜ danach |
| 4+ | Geparkt: Zeiten/Pauschalen → Rechnungsentwürfe in lexoffice; RMM-Alerts → Tickets | ⬜ |

**Bewusst NICHT bauen** (am 15.07.2026 entschieden): Rechnungserzeugung (GoBD/E-Rechnung bleibt in lexoffice, nur Sync), Passwort-Verwaltung (→ Vaultwarden o. ä.), Assets als Modul, Angebote, Wissensdatenbank, Kunden-Selbstverwaltung von Portal-Nutzern.

## Stufe 1 — Kundenakte (fertig)

Detailplan: [superpowers/plans/2026-07-15-stufe-1-kundenakte.md](superpowers/plans/2026-07-15-stufe-1-kundenakte.md)

Was existiert und E2E verifiziert ist:

- **Auth:** Login (Registrierung deaktiviert), Pflicht-2FA per TOTP mit QR-Code + Backup-Codes, Guard in `src/routes/(app)/+layout.server.ts`, erster Admin via `npm run seed:admin`. better-auth mit Plugins `admin` + `twoFactor`.
- **Firmen:** Liste mit Suche (Name/Kundennummer), Anlegen, Akte, Bearbeiten, Löschen (Cascade auf alles).
- **Ansprechpartner:** Inline-Formulare in der Akte, genau ein Hauptkontakt je Firma (Transaktion in `setPrimaryContact`).
- **Verträge:** Laufzeit/Verlängerung/Kündigungsfrist, Pauschale in Cent, Status (Entwurf/Aktiv/Gekündigt/Beendet). Kernstück ist die pure Funktion `computeContractDeadlines` in `src/lib/contracts/deadlines.ts` (rollt Verlängerungsperioden vom Startdatum aus, `renewalTermMonths=0` = läuft aus). Farbiges Fristen-Badge (rot ≤ 30 Tage, gelb ≤ 90, grün sonst) und Dashboard-Widget „Anstehende Kündigungsfristen (90 Tage)".
- **Dokumente:** Upload je Firma (max. 25 MB, ausführbare Typen geblockt, Path-Traversal-sicher: Pfade nur aus UUIDs), Download-Route mit RFC-5987-Dateinamen, Checkbox „Für Portal freigeben" (Vorhalt Stufe 3).
- **Tests:** 38 Vitest-Tests (Unit + DB-Integration gegen `corvion_test`, seriell via `fileParallelism: false`).

Architektur-Entscheidungen, die Bestand haben sollen:

- Serverlogik als testbare Funktionen in `src/lib/server/` — nehmen `db` als ersten Parameter (Tests injizieren die Test-DB).
- Form Actions statt API-Routen; zod-Validierung in `src/lib/validation/` mit deutschen Meldungen; `emptyToNull`-Muster für optionale Felder.
- Design-Tokens aus `design-system/corvion-tool/MASTER.md` als Tailwind-`@theme` in `src/routes/layout.css`; Fonts über @fontsource.
- Geld in Cent (integer), Datum als ISO-String (`mode: 'string'`).
- UI-Muster in der Akte: beschreibbares `$derived` für „welches Inline-Formular ist offen" (Action-Ergebnis setzt zurück, Klicks überschreiben).

## Deployment (gebaut, Go-Live offen)

Kompletter Stack in Docker: App (adapter-node) + PostgreSQL 16 + Caddy (automatisches Let's-Encrypt-TLS). Migrationen laufen bei jedem App-Start (`scripts/migrate.js`), Seed im Container über `scripts/seed-admin.mjs` (wird beim Image-Build aus dem TS-Skript gebündelt). Anleitung: README, Abschnitt „Deployment".

Stolpersteine, die schon gelöst sind (nicht erneut hineinlaufen):

- `drizzle-orm` und `better-auth` müssen in `dependencies` stehen (nicht dev) — `migrate.js`/Seed brauchen sie zur Laufzeit im Image.
- SvelteKits Build-Analyse importiert Servermodule → der Docker-Build-Stage braucht Dummy-Werte für `DATABASE_URL`, `BETTER_AUTH_SECRET`, `ORIGIN` (stehen im Dockerfile).
- `BODY_SIZE_LIMIT=30M` ist gesetzt (SvelteKit-Default 512 KB würde Uploads blocken).
- Compose-Projekt heißt `corvion-prod` — kollidiert nicht mit der Dev-DB aus `compose.yaml`.

**Offen für den Go-Live (braucht Manuel):** DNS-A-Record auf den VPS, Repo klonen, `.env.production` ausfüllen, `docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build`, Admin seeden, 2FA einrichten, Seed-Passwort ändern. Backup-Cron einrichten (Befehl im README).

## Stufe 2 — Ticketsystem (als Nächstes)

Abgestimmter Scope (15.07.2026):

- **E-Mail rein/raus über Microsoft Graph API** mit der Shared Mailbox `support@corvion.de`: eingehende Mails werden Tickets (bzw. Antworten auf bestehende Tickets), Antworten aus dem Tool gehen als Mail raus.
- **Tickets:** Status-Workflow, Zuordnung zu Firma + Ansprechpartner (Matching über Absenderadresse), interner Bearbeiter.
- **Einfache Zeiterfassung pro Ticket:** Minuten + Notiz + Flag „abrechenbar". Bewusst kein Timer, keine Stundensätze.
- **Voraussetzung von Manuel:** App-Registrierung in Entra ID (Client-Credentials mit `Mail.ReadWrite` + `Mail.Send` auf die Shared Mailbox, idealerweise per Application Access Policy auf diese Mailbox begrenzt).

Vor Implementierungsstart: Brainstorming-/Grill-Runde zum Feinschliff (z. B. Polling vs. Graph-Webhooks, Ticketnummern-Schema, Umgang mit Anhängen) und einen Implementierungsplan nach dem Muster von Stufe 1 schreiben.

## Stufe 3 — Kundenportal (danach)

- Kunden-Login (Portal-Nutzer legt Corvion an, keine Selbstregistrierung), Rolle „Kunde".
- Tickets erstellen und verfolgen.
- **Rechnungen aus lexoffice:** API-Sync (PDF + Zahlstatus), Anzeige im Portal. Vorhalt existiert: `companies.lexofficeContactId`.
- Explizit freigegebene Verträge/Dokumente. Vorhalt existiert: `documents.sharedWithCustomer`.

## Weiterarbeiten auf einem anderen Rechner

### Projekt-Setup (Mensch)

Steht im README: klonen von `git@github.com:Daklyrus/portal.git`, `.env` aus `.env.example`, Docker-Postgres, Migrationen (Haupt- + Test-DB), `npm run seed:admin`.

### Claude-Setup

Das meiste reist im Repo mit und funktioniert sofort:

- **CLAUDE.md** (Konventionen) liest Claude automatisch.
- **.mcp.json** verbindet den offiziellen Svelte-MCP-Server (Doku + Autofixer) automatisch.
- **Dieses Dokument + der Plan in docs/** liefern den inhaltlichen Kontext — zu Sessionbeginn darauf verweisen („lies docs/PROJEKT.md").

Nicht im Repo, weil rechnergebunden:

- **Skills** liegen unter `~/.claude/skills/` (einfache Ordner — vom alten Rechner kopieren oder neu installieren). Installiert und im Projekt aktiv genutzt:
  - superpowers-Suite (u. a. brainstorming, writing-plans, executing-plans, test-driven-development, systematic-debugging, verification-before-completion, finishing-a-development-branch) — Quelle: github.com/obra/superpowers
  - ui-ux-pro-max-Suite (Design-Intelligence; hat `design-system/corvion-tool/MASTER.md` erzeugt) inkl. design/design-system/ui-styling/banner-design/brand/slides
  - stop-slop (deutsche UI-Texte ohne Floskeln)
  - svelte-code-writer + svelte-core-bestpractices (Svelte-5-Qualität)
- **Claude-Memory** (Projektgedächtnis) ist lokal je Rechner. Dieses Dokument ersetzt es inhaltlich — bei der ersten Session auf dem neuen Rechner einmal sagen: „Merk dir den Stand aus docs/PROJEKT.md".

### Arbeitsweise (Kurzfassung)

TDD ohne Ausnahme (Test rot → implementieren → grün → deutscher Conventional Commit), Svelte-Komponenten vor Abschluss durch `npx @sveltejs/mcp svelte-autofixer`, UI-Änderungen im Browser verifizieren, `npm run check` vor jedem Commit. Details in CLAUDE.md.

## Offene Punkte (Stand 16.07.2026)

1. Go-Live auf dem Hetzner-VPS (siehe Deployment oben) — braucht Domain/DNS von Manuel
2. Seed-Admin-Passwort nach erstem Login ändern
3. Entra-ID-App-Registrierung für Stufe 2 (Voraussetzung, Manuel)
4. Stufe 2 planen und bauen
