# Corvion Tool

PSA-Tool für Corvion (MSP): Kundenakte (Firmen, Ansprechpartner, Verträge mit Kündigungsfristen, Dokumente) + Ticketsystem (E-Mail via Microsoft Graph, SLA auf Erstreaktion, Zeiterfassung) + Kundenportal unter `/portal` (Rolle `customer`, Rechnungen aus lexoffice, freigegebene Verträge/Dokumente).

**Projektstand, Roadmap-Details und Übergabe-Kontext: `docs/PROJEKT.md` — zu Sessionbeginn lesen.** Plan Stufe 1: `docs/superpowers/plans/2026-07-15-stufe-1-kundenakte.md`.

## Stack

SvelteKit 2 + Svelte 5 (Runes), TypeScript, Tailwind CSS 4, Drizzle ORM + postgres.js, better-auth (Plugins: admin, twoFactor), zod, date-fns, Vitest, PostgreSQL 16 (Docker).

## Befehle

- `docker compose up -d` — Postgres starten (DBs: `corvion`, `corvion_test`)
- `npm run dev` — Dev-Server auf :5173
- `npm test` — Vitest (Integrationstests brauchen die Test-DB; laufen seriell)
- `npm run check` — svelte-check
- `npm run db:generate` / `npm run db:migrate` — Drizzle-Migrationen (Test-DB: gleiche Befehle mit `DATABASE_URL=$TEST_DATABASE_URL`)
- `npm run auth:schema` — better-auth-Schema neu generieren (nach Auth-Plugin-Änderungen, danach Migration!)
- `npm run seed:admin` — ersten Admin anlegen (liest `SEED_ADMIN_*` aus `.env`)

## Konventionen

- **TDD:** Kein Produktionscode ohne vorher fehlschlagenden Test. Commit nach jedem grünen Schritt (Conventional Commits, deutsch).
- **Svelte 5 Runes only:** `$state`/`$derived`/`$props`, `onclick`, Snippets, keyed `{#each}`, Links über `resolve()` aus `$app/paths` (Route-IDs enthalten die Gruppe: `/(app)/firmen/[id]`). Vor Abschluss: `npx @sveltejs/mcp svelte-autofixer <datei>`.
- **Form Actions statt API-Routen** für alle Formulare; Validierung mit zod in `src/lib/validation/` (deutsche Fehlermeldungen), Serverlogik als testbare Funktionen in `src/lib/server/` (nehmen `db` als Parameter).
- **Design-Tokens** aus `design-system/corvion-tool/MASTER.md` sind in `src/routes/layout.css` als Tailwind-`@theme` hinterlegt — keine rohen Hex-Werte in Components, keine Emojis als Icons (Lucide), Fonts über @fontsource (kein Google-CDN).
- **Geld in Cent (integer), Datum als ISO-String** (`date`-Spalten mit `mode: 'string'`).
- **Deutsche UI-Texte, direkt und floskelfrei** (stop-slop): „Vertrag speichern", nicht „Hier können Sie…".
- Auth: Registrierung ist deaktiviert, interne Nutzer werden geseedet; 2FA ist Pflicht (Guard in `src/routes/(app)/+layout.server.ts`).
- Uploads liegen unter `data/uploads/<companyId|tickets/<ticketId>>/<uuid>.<ext>` — Pfade nie aus Nutzereingaben bauen (`src/lib/server/documents/storage.ts`).
- **Graph-Aufrufe nur über das `GraphClient`-Interface** (`src/lib/server/graph/client.ts`), lexoffice nur über `LexofficeClient` — in Tests immer gemockt, nie echte APIs. Mail-HTML in beide Richtungen durch `sanitizeMailHtml`.
- Poller starten in `hooks.server.ts` hinter `TICKET_SYNC=on` (Entra-Setup: `docs/entra-id-setup.md`) bzw. `LEXOFFICE_SYNC=on`.
- **Zugriffsschutz liegt zentral in `hooks.server.ts`** (Auth, Rollentrennung intern/Portal, 2FA-Pflicht) — Layout-Guards greifen NICHT bei Form Actions und sind nur zweite Verteidigungslinie. Neue öffentliche Routen müssen dort in `PUBLIC_PATHS`.
- **Portal-Queries binden IMMER an die companyId** aus `getPortalContext` (`src/lib/server/portal/`); Kunden sehen nie Notizen (`kind='note'`), SLA-/Bearbeiter-Daten oder fremde Firmen. Serverseitige Auth-Instanzen für Nutzeranlage brauchen `requestCookies: false`, sonst ersetzt `signUpEmail` die Session des Admins.

## Für später vorgemerkt

- `companies.lexofficeContactId` und `documents.sharedWithCustomer` sind Vorhalte für Stufe 3 (Portal + lexoffice-Sync).
- Nicht bauen: Rechnungserzeugung (bleibt in lexoffice), Passwort-Verwaltung, Assets, Angebote, Wissensdatenbank.
