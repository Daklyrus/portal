# Corvion Tool — Projektstand & Roadmap

Dieses Dokument ist die Übergabe-Quelle für die Weiterarbeit — egal ob auf einem anderen Rechner, mit einer frischen Claude-Session oder nach längerer Pause. Es hält fest, was gebaut ist, was als Nächstes kommt und welche Entscheidungen dahinterstehen. **Bei Weiterarbeit mit Claude: dieses Dokument zu Beginn der Session nennen.**

Stand: 17.07.2026

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
| 2 | Ticketsystem: E-Mail via Microsoft Graph, SLA, Zeiterfassung | ✅ fertig (16.07.2026), Entra-Setup offen |
| 3 | Kundenportal: Tickets, Rechnungen aus lexoffice, freigegebene Dokumente | ✅ fertig (16.07.2026), lexoffice-Key offen |
| 4 | Abrechnungsläufe: Rechnungsentwürfe in lexoffice aus Pauschalen + Zeiten | ✅ fertig (17.07.2026) |
| 5+ | Geparkt: RMM-/Monitoring-Alerts → Tickets | ⬜ |

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

## Stufe 2 — Ticketsystem (fertig, 16.07.2026)

Detailplan mit allen abgestimmten Entscheidungen: [superpowers/plans/2026-07-16-stufe-2-ticketsystem.md](superpowers/plans/2026-07-16-stufe-2-ticketsystem.md). Gebaut und verifiziert (99 Tests, UI im Browser durchgespielt):

- **Mail-Sync** (Poller alle 90 s, Graph-Delta-Query auf Inbox + Gesendete von `support@corvion.de`): Mail ohne `[#T-…]` im Betreff → neues Ticket + Auto-Eingangsbestätigung; mit Nummer bzw. passender `conversationId` → Antwort im Thread. Verarbeitete Mails wandern in den Outlook-Ordner „Im Tool". Kein Alt-Import beim Start.
- **Tickets:** Nummern ab T-1001, Status Neu→In Arbeit→Wartet auf Kunde→Gelöst→Geschlossen mit Auto-Reopen, Priorität mit **SLA auf Erstreaktion** (Kritisch 2 h / Hoch 4 h / Normal 8 h, Geschäftszeiten Mo–Fr 8–17, NRW-Feiertage — pure Logik in `src/lib/tickets/sla.ts`), unbekannte Absender → Ticket ohne Firma mit Zuordnungs-Kasten (legt optional den Kontakt an), Anhänge am Ticket, interne Notizen, manuelle Tickets mit proaktiver Erst-Mail.
- **Antworten** aus dem Tool per Graph `sendMail` (Tiptap-Editor: fett/kursiv/Listen/Links/Code/Überschriften; Signatur automatisch). Aus Outlook gesendete Antworten mit Ticketnummer werden in den Verlauf übernommen.
- **Zeiterfassung** je Ticket (Minuten/Notiz/abrechenbar/Datum) + Monatsreport je Firma unter `/berichte/zeiten` als lexoffice-Abrechnungsgrundlage.
- Dashboard: Kacheln (Offen/Neu/SLA überfällig) + Liste der dringendsten Tickets.

**Go-Live-Voraussetzung (Manuel):** Entra-ID-App-Registrierung nach [entra-id-setup.md](entra-id-setup.md), Werte in `.env.production`, `TICKET_SYNC=on`. Bis dahin läuft alles außer Mailversand/-empfang.

Architektur-Notizen: Graph nur über das mockbare `GraphClient`-Interface; Mail-HTML in beide Richtungen durch `sanitizeMailHtml`; Delta-Links in der Tabelle `sync_state`; Poller startet einmalig in `hooks.server.ts`.

## Stufe 3 — Kundenportal (fertig, 16.07.2026)

Detailplan mit allen abgestimmten Entscheidungen: [superpowers/plans/2026-07-16-stufe-3-kundenportal.md](superpowers/plans/2026-07-16-stufe-3-kundenportal.md). Gebaut und verifiziert (123 Tests, kompletter Einladungs- und Kunden-Flow im Browser durchgespielt):

- **Zugänge:** je Ansprechpartner in der Kundenakte („Portal-Zugang einladen" → Mail mit 48-h-Passwort-Link über die Shared Mailbox, better-auth-Reset-Mechanik). Rolle `customer`, Bindung an die Firma über `portal_access`. 2FA für Kunden optional. „Passwort vergessen" auf der Login-Seite für alle.
- **Portal** unter `/portal` (eigenes schlankes Layout, gleiche App): alle Tickets der eigenen Firma (ohne Notizen/SLA/Bearbeiter), Anfragen erstellen/beantworten (mit Anhängen), Lösungs-Bestätigung (Gelöst → Geschlossen bzw. Widerspruch → In Arbeit); Rechnungen (Status-Badges, PDF on-demand von lexoffice); freigegebene Verträge (inkl. nächster Verlängerung) und Dokumente.
- **lexoffice:** stündlicher Sync (`LEXOFFICE_SYNC=on` + Key) über mockbaren Client in die Tabelle `invoices`; Zuordnung über `companies.lexofficeContactId` (Feld in der Firmen-Akte).

**Zwei Sicherheitsfunde aus der Browser-Verifikation — beide gefixt und als Konvention in CLAUDE.md verankert:**
1. Server-seitiges `signUpEmail` mit Cookie-Plugin ersetzte die Admin-Session durch die des neu angelegten Kunden → Auth-Instanzen für Nutzeranlage brauchen `requestCookies: false`.
2. **Layout-Guards greifen nicht bei Form Actions** — anonyme POSTs führten Actions aus. Fix: zentraler Guard in `hooks.server.ts` (Auth + Rollentrennung + 2FA-Pflicht vor dem Routing).

**Offen (Manuel):** lexoffice-API-Key besorgen (app.lexoffice.de → Extras → Public API), `LEXOFFICE_API_KEY` + `LEXOFFICE_SYNC=on` setzen, lexoffice-Kontakt-IDs an den Firmen pflegen.

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

## Stufe 4 — Abrechnungsläufe (fertig, 17.07.2026)

Detailplan mit allen abgestimmten Entscheidungen: [superpowers/plans/2026-07-17-stufe-4-abrechnung.md](superpowers/plans/2026-07-17-stufe-4-abrechnung.md). Gebaut und verifiziert (143 Tests, UI-Roundtrip im Browser):

- **Seite „Abrechnung":** Monat wählen (Default Vormonat) → Vorschau je Firma: Pauschal-Verträge (aktiv, Pauschale > 0, mit Hinweis bei Vertragsbeginn im Monat) + abrechenbare offene Zeiten exakt summiert (247 min = 4,12 h) × Stundensatz. Firmen ohne `lexofficeContactId` rot und ohne Erzeugen-Knopf; ohne `LEXOFFICE_API_KEY` Hinweis-Banner.
- **Stundensatz netto:** Standard in `app_settings` (auf der Seite pflegbar, Fallback 95 €), je Firma überschreibbar (Feld in der Akte, `companies.hourlyRateCents`).
- **Entwurf:** `POST /v1/invoices` (ohne finalize) — Pauschal-Positionen einzeln, eine Aufwandsposition mit Einzelnachweis in der Beschreibung, netto + 19 %, Leistungszeitraum im Einleitungstext. Cent→Euro nur in `billing/draft.ts`.
- **Doppel-Schutz:** `billing_runs` (unique Firma+Monat); enthaltene Zeiten bekommen `billingRunId` und verschwinden aus der Vorschau. „Verwerfen" löscht den Lauf → `SET NULL` gibt die Zeiten frei (lexoffice-Entwurf manuell löschen).

**Offen (Manuel):** erster echter Lauf, sobald der lexoffice-Key da ist — Vorschau prüfen, Entwurf erzeugen, in lexoffice kontrollieren.

## Offene Punkte (Stand 17.07.2026)

1. Go-Live auf dem Hetzner-VPS (siehe Deployment oben) — braucht Domain/DNS von Manuel
2. Seed-Admin-Passwort ändern (Passwort-Ändern-UI fehlt noch — vorgemerkter Task)
3. Entra-ID-App-Registrierung nach [entra-id-setup.md](entra-id-setup.md), dann `TICKET_SYNC=on` und Funktionstest mit echter Mail
4. lexoffice-API-Key + `LEXOFFICE_SYNC=on` + Kontakt-IDs an Firmen pflegen; danach ersten Abrechnungslauf testen
5. Stufe 5+ (geparkt): RMM-/Monitoring-Alerts → Tickets (falls das RMM Alert-Mails an support@ senden kann, geht das schon heute über den Mail-Sync)
