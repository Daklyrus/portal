# Stufe 1: Kundenakte — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Internes PSA-Tool für Corvion — Stufe 1 liefert die Kundenakte: Firmen, Ansprechpartner, Verträge mit Kündigungsfristen-Logik und Dokumentenablage, hinter einem Login für 1–3 interne Nutzer.

**Architecture:** SvelteKit-2-Monolith (Svelte 5, Runes-Mode) mit serverseitigem Rendering und Form Actions. PostgreSQL 16 über Drizzle ORM, Auth über better-auth (E-Mail/Passwort, 2FA). Dateien liegen auf Disk unter `data/uploads/`, Metadaten in der DB. Alles läuft in Docker (dev: nur Postgres im Container, App via `npm run dev`).

**Tech Stack:** SvelteKit 2 + Svelte 5 (TypeScript), Tailwind CSS 4, Drizzle ORM + postgres.js, better-auth (Plugins: admin, twoFactor), zod, date-fns, Vitest, PostgreSQL 16 (Docker), @fontsource (Poppins, Open Sans — selbst gehostet).

## Global Constraints

- **Svelte 5 Runes-Mode only:** `$state`/`$derived`/`$props`, `onclick` statt `on:click`, Snippets statt Slots, keyed `{#each}`. Vor Fertigstellung jedes Components: `npx @sveltejs/mcp svelte-autofixer <datei>`.
- **Form Actions, keine API-Routen für Formulare** (`+page.server.ts` `actions`).
- **TDD:** Kein Produktionscode ohne vorher fehlschlagenden Test (Vitest). Reihenfolge je Schritt: Test schreiben → rot sehen → implementieren → grün sehen → committen.
- **Design-System:** Farben/Typo/Abstände ausschließlich aus `design-system/corvion-tool/MASTER.md` als Tailwind-Theme-Tokens. Keine rohen Hex-Werte in Components. Keine Emojis als Icons (SVG: Lucide). Fokus-Ringe sichtbar, Kontrast ≥ 4.5:1.
- **Deutsche UI-Texte nach stop-slop:** direkt, aktiv, ohne Füllwörter. Beispiel: „Vertrag speichern", nicht „Hier können Sie Ihren Vertrag speichern".
- **DSGVO:** Keine Google-Fonts vom CDN (via @fontsource bundeln), keine externen CDNs.
- **Geld in Cent (integer), Datumswerte als ISO-String `yyyy-MM-dd`** (Drizzle `date`-Spalten mit `mode: 'string'`).
- **Commits:** Nach jedem grünen Schritt, Conventional Commits (`feat:`, `test:`, `chore:`).
- **Secrets** nur in `.env` (gitignored); `.env.example` wird gepflegt.

## File Structure (Zielbild Stufe 1)

```
docker-compose.yml            # Postgres 16 (dev)
drizzle.config.ts
src/
  app.css                     # Tailwind 4 @theme mit Design-Tokens
  hooks.server.ts             # better-auth Handler + Session in locals
  lib/
    contracts/deadlines.ts    # Pure Fristen-Logik (kein DB-Zugriff)
    validation/
      company.ts  contact.ts  contract.ts  document.ts   # zod-Schemas
    server/
      db/index.ts             # postgres.js Client + drizzle()
      db/schema.ts            # companies, contacts, contracts, documents
      db/auth-schema.ts       # von better-auth CLI generiert
      auth.ts                 # betterAuth()-Konfiguration
      documents/storage.ts    # Datei speichern/löschen unter data/uploads/
    components/               # AppShell, PageHeader, DataTable, FormField, …
  routes/
    login/+page.svelte, +page.server.ts
    (app)/+layout.server.ts   # Auth-Guard + 2FA-Pflicht
    (app)/+layout.svelte      # App-Shell (Sidebar-Navigation)
    (app)/+page.server.ts, +page.svelte          # Dashboard mit Fristen-Widget
    (app)/firmen/+page.server.ts, +page.svelte   # Liste
    (app)/firmen/neu/…                           # Anlegen
    (app)/firmen/[id]/…                          # Akte: Stammdaten, Kontakte, Verträge, Dokumente
    (app)/firmen/[id]/bearbeiten/…
scripts/seed-admin.ts
src/lib/**/*.test.ts          # Vitest, colocated
```

---

### Task 1: Projekt-Scaffold

**Files:** Create: komplettes SvelteKit-Gerüst, `docker-compose.yml`, `drizzle.config.ts`, `.env`, `.env.example`, `CLAUDE.md`

**Interfaces:** Produces: laufendes `npm run dev`, laufende Postgres-Instanz `corvion` + `corvion_test`, `npm test` (Vitest) grün.

- [ ] **Step 1:** Scaffold in Temp-Ordner erzeugen und ins Repo verschieben (Repo-Root ist nicht leer):

```bash
cd "$SCRATCHPAD" && npx sv create corvion-app --template minimal --types ts --no-add-ons --install npm
rsync -a --exclude node_modules corvion-app/ /Users/manuelbesel/Desktop/Corvion/
cd /Users/manuelbesel/Desktop/Corvion && npm install
```

- [ ] **Step 2:** Add-ons: `npx sv add tailwindcss vitest drizzle --install npm` — bei Drizzle-Prompts: PostgreSQL, postgres.js, Docker ja. Prüfen: `docker-compose.yml` und `drizzle.config.ts` existieren.
- [ ] **Step 3:** Weitere Dependencies: `npm i better-auth zod date-fns @fontsource/poppins @fontsource/open-sans lucide-svelte && npm i -D tsx`
- [ ] **Step 4:** `docker compose up -d` und Test-DB anlegen: `docker compose exec db psql -U postgres -c 'CREATE DATABASE corvion_test;'` (Service-/User-Namen aus generierter docker-compose übernehmen).
- [ ] **Step 5:** `.env` prüfen/ergänzen (`DATABASE_URL`, `BETTER_AUTH_SECRET` via `openssl rand -hex 32`, `BETTER_AUTH_URL=http://localhost:5173`), `.env.example` spiegeln, `.gitignore` um `data/` ergänzen.
- [ ] **Step 6:** Smoke: `npm run dev` startet, `npm test` läuft (0 Tests ok), `npm run check` grün.
- [ ] **Step 7:** Commit: `chore: scaffold sveltekit + tailwind + drizzle + vitest`

### Task 2: Datenmodell

**Files:** Create: `src/lib/server/db/schema.ts`, Test: `src/lib/server/db/schema.test.ts`

**Interfaces:** Produces: Tabellen `companies`, `contacts`, `contracts`, `documents`; Typen `Company`, `Contact`, `Contract`, `Document` (via `$inferSelect`).

- [ ] **Step 1: Failing Test** — Integrationstest gegen `corvion_test`: Firma einfügen → auslesen; Kontakt mit `companyId` einfügen; Firma löschen → Kontakt weg (cascade). Test nutzt eigenen postgres.js-Client mit `TEST_DATABASE_URL`.
- [ ] **Step 2:** Rot laufen sehen: `npm test -- schema` → Fehler „relation companies does not exist".
- [ ] **Step 3: Schema implementieren:**

```ts
// src/lib/server/db/schema.ts
import { pgTable, text, uuid, boolean, integer, date, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { user } from './auth-schema';

const timestamps = {
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
};

export const companies = pgTable('companies', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull(),
	customerNumber: text('customer_number').unique(),
	street: text('street'),
	zip: text('zip'),
	city: text('city'),
	email: text('email'),
	phone: text('phone'),
	website: text('website'),
	notes: text('notes'),
	lexofficeContactId: text('lexoffice_contact_id'), // Stufe 3: Rechnungs-Sync
	...timestamps
});

export const contacts = pgTable('contacts', {
	id: uuid('id').primaryKey().defaultRandom(),
	companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
	firstName: text('first_name').notNull(),
	lastName: text('last_name').notNull(),
	position: text('position'),
	email: text('email'),
	phone: text('phone'),
	mobile: text('mobile'),
	isPrimary: boolean('is_primary').default(false).notNull(),
	notes: text('notes'),
	...timestamps
});

export const contractStatus = pgEnum('contract_status', ['draft', 'active', 'cancelled', 'ended']);

export const contracts = pgTable('contracts', {
	id: uuid('id').primaryKey().defaultRandom(),
	companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
	title: text('title').notNull(),
	description: text('description'),
	status: contractStatus('status').default('draft').notNull(),
	startDate: date('start_date', { mode: 'string' }).notNull(),
	initialTermMonths: integer('initial_term_months').notNull(),
	renewalTermMonths: integer('renewal_term_months').default(12).notNull(), // 0 = läuft aus
	noticePeriodMonths: integer('notice_period_months').default(3).notNull(),
	monthlyFeeCents: integer('monthly_fee_cents').default(0).notNull(),
	includedServices: text('included_services'),
	cancelledAt: date('cancelled_at', { mode: 'string' }),
	...timestamps
});

export const documents = pgTable('documents', {
	id: uuid('id').primaryKey().defaultRandom(),
	companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
	fileName: text('file_name').notNull(),
	storagePath: text('storage_path').notNull(),
	mimeType: text('mime_type').notNull(),
	sizeBytes: integer('size_bytes').notNull(),
	sharedWithCustomer: boolean('shared_with_customer').default(false).notNull(), // Stufe 3: Portal
	uploadedById: text('uploaded_by_id').references(() => user.id),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export type Company = typeof companies.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Contract = typeof contracts.$inferSelect;
export type Document = typeof documents.$inferSelect;
```

Hinweis: `auth-schema.ts` entsteht erst in Task 4 — bis dahin `uploadedById` ohne `.references()` anlegen und in Task 4 nachziehen (Migration).

- [ ] **Step 4:** Migration generieren + einspielen (dev und test): `npx drizzle-kit generate && npx drizzle-kit migrate`, Test-DB via `DATABASE_URL=$TEST_DATABASE_URL npx drizzle-kit migrate`.
- [ ] **Step 5:** `npm test -- schema` → PASS. `npm run check` grün.
- [ ] **Step 6:** Commit: `feat: datenmodell kundenakte (companies, contacts, contracts, documents)`

### Task 3: Vertragsfristen-Logik (pure)

**Files:** Create: `src/lib/contracts/deadlines.ts`, Test: `src/lib/contracts/deadlines.test.ts`

**Interfaces:** Produces:

```ts
export interface ContractTerms {
	startDate: string;           // ISO yyyy-MM-dd
	initialTermMonths: number;
	renewalTermMonths: number;   // 0 = Vertrag läuft aus
	noticePeriodMonths: number;
}
export interface ContractDeadlines {
	currentPeriodEnd: string;            // letzter Tag der laufenden Periode
	cancellationDeadline: string;        // letzter Tag für fristgerechte Kündigung
	daysUntilCancellationDeadline: number; // negativ = Frist verpasst (nächste Periode läuft)
	autoRenews: boolean;
	hasEnded: boolean;                   // ausgelaufen (renewalTermMonths=0 und Ende < heute)
}
export function computeContractDeadlines(terms: ContractTerms, today: Date): ContractDeadlines;
```

Semantik: Periodenende = Start + Laufzeit − 1 Tag. Solange Periodenende < heute und Verlängerung > 0: Periodenende += Verlängerungsmonate. Kündigungsdeadline = (Periodenende + 1 Tag) − Kündigungsfrist-Monate − 1 Tag. Beispiel: Start 01.01.2026, 12 Monate, 3 Monate Frist → Periodenende 31.12.2026, Kündigung bis 30.09.2026.

- [ ] **Step 1: Failing Tests** (alle vier, komplett):

```ts
import { describe, it, expect } from 'vitest';
import { computeContractDeadlines } from './deadlines';

const base = { startDate: '2026-01-01', initialTermMonths: 12, renewalTermMonths: 12, noticePeriodMonths: 3 };

describe('computeContractDeadlines', () => {
	it('berechnet Periodenende und Kündigungsdeadline der Erstlaufzeit', () => {
		const d = computeContractDeadlines(base, new Date('2026-07-15'));
		expect(d.currentPeriodEnd).toBe('2026-12-31');
		expect(d.cancellationDeadline).toBe('2026-09-30');
		expect(d.daysUntilCancellationDeadline).toBe(77);
		expect(d.autoRenews).toBe(true);
		expect(d.hasEnded).toBe(false);
	});
	it('rollt nach Ablauf in die Verlängerungsperiode', () => {
		const d = computeContractDeadlines(base, new Date('2027-02-01'));
		expect(d.currentPeriodEnd).toBe('2027-12-31');
		expect(d.cancellationDeadline).toBe('2027-09-30');
	});
	it('meldet verpasste Frist mit negativen Tagen', () => {
		const d = computeContractDeadlines(base, new Date('2026-10-15'));
		expect(d.currentPeriodEnd).toBe('2026-12-31');
		expect(d.daysUntilCancellationDeadline).toBe(-15);
	});
	it('auslaufender Vertrag (renewal 0) endet statt zu rollen', () => {
		const d = computeContractDeadlines({ ...base, renewalTermMonths: 0 }, new Date('2027-02-01'));
		expect(d.currentPeriodEnd).toBe('2026-12-31');
		expect(d.hasEnded).toBe(true);
		expect(d.autoRenews).toBe(false);
	});
});
```

- [ ] **Step 2:** `npm test -- deadlines` → FAIL („deadlines.ts not found").
- [ ] **Step 3: Implementieren** mit date-fns (`addMonths`, `addDays`, `subDays`, `subMonths`, `isBefore`, `differenceInCalendarDays`, `format`, `parseISO`) exakt nach obiger Semantik.
- [ ] **Step 4:** `npm test -- deadlines` → PASS (alle 4).
- [ ] **Step 5:** Commit: `feat: vertragsfristen-logik mit verlaengerungs-rollover`

### Task 4: Auth (better-auth)

**Files:** Create: `src/lib/server/auth.ts`, `src/lib/server/db/auth-schema.ts` (generiert), `src/hooks.server.ts`, `src/routes/login/+page.svelte`, `src/routes/login/+page.server.ts`, `src/routes/(app)/+layout.server.ts`, `scripts/seed-admin.ts`, `src/app.d.ts` (locals-Typen)

**Interfaces:** Produces: `auth` (better-auth-Instanz), `locals.user`/`locals.session`, Route-Guard: alles unter `(app)` erfordert Login; `user.role` ∈ {`admin`,`user`}.

- [ ] **Step 1:** Konfiguration:

```ts
// src/lib/server/auth.ts
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin, twoFactor } from 'better-auth/plugins';
import { env } from '$env/dynamic/private';
import { db } from './db';
import * as schema from './db/auth-schema';

export const auth = betterAuth({
	baseURL: env.BETTER_AUTH_URL,
	secret: env.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'pg', schema }),
	emailAndPassword: { enabled: true, disableSignUp: true }, // interne Nutzer werden geseedet
	plugins: [admin(), twoFactor()]
});
```

- [ ] **Step 2:** Schema generieren: `npx @better-auth/cli@latest generate --config src/lib/server/auth.ts --output src/lib/server/db/auth-schema.ts` (Flags ggf. an CLI-Version anpassen, `--help` prüfen). Danach `documents.uploadedById` auf `references(() => user.id)` umstellen, Migration generieren + einspielen.
- [ ] **Step 3:** `hooks.server.ts`: `svelteKitHandler({ event, resolve, auth, building })` aus `better-auth/svelte-kit`; davor Session laden und in `event.locals` legen. `app.d.ts`: `locals.user`, `locals.session` typisieren.
- [ ] **Step 4:** Guard `src/routes/(app)/+layout.server.ts`: kein `locals.user` → `redirect(302, '/login')`. Login-Seite mit `authClient.signIn.email(...)` (`better-auth/svelte`-Client in `src/lib/auth-client.ts`), Fehlertext deutsch: „E-Mail oder Passwort falsch."
- [ ] **Step 5:** Seed-Skript `scripts/seed-admin.ts`: legt Admin über `auth.api.createUser` an (liest `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` aus `.env`); Ausführung: `npx tsx scripts/seed-admin.ts`, idempotent (existiert → skip).
- [ ] **Step 6: Test** (Vitest, gegen Test-DB): `auth.api.signInEmail` mit geseedetem Nutzer liefert Session; falsches Passwort wirft. Rot sehen → implementieren war Step 1–5, hier grün laufen lassen. (Reihenfolge-Ausnahme dokumentiert: Auth-Verdrahtung ist Konfiguration, der Test sichert das Verhalten.)
- [ ] **Step 7:** Manuell: `npm run dev`, Login mit Seed-Admin → Redirect auf `/`, Logout funktioniert.
- [ ] **Step 8:** Commit: `feat: login mit better-auth, seed-admin, route-guard`

**2FA-Pflicht (Teil 2 dieses Tasks):**
- [ ] **Step 9:** Guard erweitern: eingeloggter Nutzer ohne `twoFactorEnabled` wird auf `/einstellungen/sicherheit` geleitet (außer er ist schon dort). Seite: 2FA aktivieren (TOTP-URI + QR via `authClient.twoFactor.enable`), Backup-Codes anzeigen. Login-Flow: nach Passwort `twoFactorRedirect` → `/login/2fa` mit TOTP-Eingabe.
- [ ] **Step 10:** Manuell verifizieren (Authenticator-App), dann Commit: `feat: pflicht-2fa fuer interne nutzer`

### Task 5: App-Shell & Design-Tokens

**Files:** Create: `src/app.css` (Theme), `src/routes/(app)/+layout.svelte`, `src/lib/components/{AppShell,PageHeader,Button,FormField,DataTable,EmptyState}.svelte`

**Interfaces:** Produces: Tailwind-Tokens `primary/accent/background/foreground/muted/border/destructive`, `font-sans`/`font-display`; Sidebar-Navigation: Dashboard, Firmen, (später: Tickets, Portal ausgegraut weglassen — YAGNI).

- [ ] **Step 1:** `app.css`: `@import 'tailwindcss';` + `@theme`-Block mit den Farben aus `design-system/corvion-tool/MASTER.md` (Primary `#0F172A`, Accent `#0369A1`, Background `#F8FAFC`, Foreground `#020617`, Muted `#E8ECF1`, Border `#E2E8F0`, Destructive `#DC2626`), `--font-display: 'Poppins'`, `--font-sans: 'Open Sans'`; Fontsource-Imports in `+layout.svelte`.
- [ ] **Step 2:** AppShell: schmale Sidebar (Lucide-Icons + Label), Topbar mit Nutzername + Logout-Button, Content-Bereich `max-w-6xl`. Dichte Abstände (Density 8/10: 8–32px-Skala). Fokus-States sichtbar, `cursor-pointer` auf Klickbarem, Übergänge 150ms.
- [ ] **Step 3:** `svelte-autofixer` über alle neuen Components, `npm run check` grün.
- [ ] **Step 4:** Commit: `feat: app-shell mit design-tokens aus master-design-system`

### Task 6: Firmen (CRUD)

**Files:** Create: `src/lib/validation/company.ts` (+`.test.ts`), `src/routes/(app)/firmen/+page.server.ts`, `+page.svelte`, `neu/+page.server.ts`, `neu/+page.svelte`, `[id]/+page.server.ts`, `[id]/+page.svelte`, `[id]/bearbeiten/…`

**Interfaces:** Produces: `companySchema` (zod), Firmenliste mit Suche, Akte-Detailseite (Tabs/Abschnitte: Stammdaten, Kontakte, Verträge, Dokumente — letztere drei füllen Tasks 7–9).

- [ ] **Step 1: Failing Test** für `companySchema`: Name Pflicht (min 1), E-Mail optional aber valide, PLZ optional 4–5 Ziffern; `parse`-Fehler deutsch via `z.string().min(1, 'Name ist Pflicht')`.
- [ ] **Step 2:** Rot → Schema implementieren → grün → Commit `feat: firmen-validierung`.
- [ ] **Step 3: Failing Test** für Server-Logik: `createCompany(db, input)`/`updateCompany`/`searchCompanies` als Funktionen in `src/lib/server/companies.ts` (testbar ohne HTTP), Integrationstest gegen Test-DB: anlegen → suchen (`ilike` auf Name/Kundennummer) → ändern → löschen.
- [ ] **Step 4:** Rot → implementieren → grün → Commit `feat: firmen-serverlogik`.
- [ ] **Step 5:** Routen: Liste (`DataTable`: Name, Kundennummer, Ort, Ansprechpartner-Zahl; Suchfeld als GET-Form), Neu/Bearbeiten (ein geteiltes `CompanyForm.svelte`, Form Action mit `fail(400, { errors, values })`, Fehler am Feld), Detailseite lädt Firma + Zähler. Löschen: Form Action mit Bestätigungsdialog („Firma und alle zugehörigen Daten löschen?").
- [ ] **Step 6:** `svelte-autofixer` über alle Components; manuell durchklicken (anlegen, suchen, bearbeiten, löschen); `npm run check` + `npm test` grün.
- [ ] **Step 7:** Commit: `feat: firmenverwaltung mit suche und akte`

### Task 7: Kontakte

**Files:** Create: `src/lib/validation/contact.ts` (+Test), `src/lib/server/contacts.ts` (+Test), `src/lib/components/ContactCard.svelte`; Modify: `src/routes/(app)/firmen/[id]/+page.server.ts`, `+page.svelte` (Abschnitt „Ansprechpartner")

**Interfaces:** Consumes: `companies` aus Task 2/6. Produces: `contactSchema` (Vorname/Nachname Pflicht, E-Mail valide optional), CRUD-Actions `createContact`/`updateContact`/`deleteContact`/`setPrimary` (genau einer je Firma primär: Transaktion setzt alle anderen auf `false`).

- [ ] **Step 1–4:** TDD wie Task 6 (Validierung, dann Serverlogik inkl. `setPrimary`-Transaktionstest: zwei Kontakte, zweiten primär setzen → erster nicht mehr primär).
- [ ] **Step 5:** UI in der Akte: Kontaktkarten-Grid, Inline-Formular (Modal oder Aufklappbereich), Primär-Badge „Hauptkontakt". Form Actions auf der `[id]`-Route (`?/createContact` usw.).
- [ ] **Step 6:** Autofixer + manuelle Prüfung + Commit: `feat: ansprechpartner je firma`

### Task 8: Verträge + Fristen-UI + Dashboard

**Files:** Create: `src/lib/validation/contract.ts` (+Test), `src/lib/server/contracts.ts` (+Test), `src/lib/components/{ContractCard,DeadlineBadge}.svelte`; Modify: Akte-Seite (Abschnitt „Verträge"), `src/routes/(app)/+page.server.ts`/`+page.svelte` (Dashboard)

**Interfaces:** Consumes: `computeContractDeadlines` aus Task 3. Produces: `contractSchema` (Titel Pflicht, startDate ISO, Monatswerte ≥ 0, Cents ≥ 0), `getContractsWithDeadlines(db, companyId?)` → Contract + ContractDeadlines, `getUpcomingDeadlines(db, withinDays)` fürs Dashboard.

- [ ] **Step 1–4:** TDD: Validierung; Serverlogik-Test: aktiver Vertrag mit Frist in 40 Tagen erscheint in `getUpcomingDeadlines(db, 90)`, gekündigter (`status='cancelled'`) nicht.
- [ ] **Step 5:** UI Akte: Vertragskarten mit Status-Badge (Entwurf/Aktiv/Gekündigt/Beendet), Eckdaten (Pauschale als `1.234,56 €` via `Intl.NumberFormat('de-DE')`), `DeadlineBadge`: grün > 90 Tage, gelb ≤ 90, rot ≤ 30, grau verpasst — Text z. B. „Kündbar bis 30.09.2026 (in 77 Tagen)". Aktionen: anlegen, bearbeiten, „Als gekündigt markieren" (setzt `status` + `cancelledAt`).
- [ ] **Step 6:** Dashboard `/`: Widget „Anstehende Kündigungsfristen (90 Tage)" — Liste Firma → Vertrag → Deadline, sortiert aufsteigend; leer-Zustand: „Keine Fristen in den nächsten 90 Tagen."
- [ ] **Step 7:** Autofixer + manuell + Commit: `feat: vertraege mit kuendigungsfristen und dashboard-widget`

### Task 9: Dokumente

**Files:** Create: `src/lib/server/documents/storage.ts` (+Test), `src/lib/validation/document.ts`, Routen-Erweiterung Akte (Abschnitt „Dokumente"), Download-Route `src/routes/(app)/firmen/[id]/dokumente/[docId]/+server.ts`

**Interfaces:** Produces: `saveUpload(file: File, companyId) → { storagePath, sizeBytes, mimeType }` (Ablage `data/uploads/<companyId>/<uuid>.<ext>`), `deleteStoredFile(storagePath)`; Download nur für eingeloggte Nutzer, `Content-Disposition: attachment` mit Original-Dateinamen.

- [ ] **Step 1: Failing Test** storage: Datei speichern → existiert unter `data/uploads/…`, Pfad enthält keine Nutzereingabe (Path-Traversal-Test: `fileName: '../../evil'` landet NICHT außerhalb), löschen → weg. Limits: max 25 MB, Blockliste ausführbarer Typen (`.exe`, `.bat`, `.sh`).
- [ ] **Step 2–3:** Rot → implementieren → grün → Commit `feat: dateiablage mit path-traversal-schutz`.
- [ ] **Step 4:** UI: Upload-Form (Form Action, `enctype="multipart/form-data"`), Tabelle (Name, Größe `Intl`-formatiert, Datum, Uploader), Checkbox „Für Portal freigeben" (wirkt erst Stufe 3, wird gespeichert), Löschen mit Bestätigung. Download über `+server.ts` (liest DB-Eintrag, streamt Datei).
- [ ] **Step 5:** Autofixer + manuell (PDF hochladen, herunterladen, löschen) + Commit: `feat: dokumentenablage je firma`

### Task 10: Abschluss

- [ ] **Step 1:** `CLAUDE.md` im Repo: Stack, Befehle (`npm run dev/test/check`, drizzle-kit, seed), Konventionen (Global Constraints dieses Plans).
- [ ] **Step 2:** `README.md`: Setup in 5 Schritten (clone → `.env` → docker compose → migrate → seed → dev).
- [ ] **Step 3:** Voller Durchlauf: `npm test`, `npm run check`, `npm run build` grün; manueller Rundgang durch alle Flows.
- [ ] **Step 4:** Superpowers-Skill `finishing-a-development-branch` folgen (Branch abschließen).
- [ ] **Step 5:** Commit: `docs: readme und claude.md fuer stufe 1`

---

## Self-Review (erledigt)

- Spec-Abdeckung: Firmen ✓ (T6), Kontakte ✓ (T7), Verträge+Fristen+Erinnerung ✓ (T3/T8, Erinnerung = Dashboard-Widget; E-Mail-Erinnerung bewusst Stufe 2+, wenn Graph-Anbindung existiert), Dokumente ✓ (T9), Login/2FA ✓ (T4), Design-System ✓ (T5).
- Typkonsistenz: `computeContractDeadlines`-Signatur in T3 = Verwendung in T8; Schema-Typen aus T2 überall via `$inferSelect`.
- Bewusste Lücken: E-Mail-Versand (Erinnerungen) und lexoffice-Sync sind NICHT Stufe 1.
