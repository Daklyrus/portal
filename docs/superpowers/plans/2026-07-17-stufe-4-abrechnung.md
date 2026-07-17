# Stufe 4: Abrechnungsläufe — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Monatliche Rechnungsentwürfe in lexoffice aus Vertragspauschalen + abrechenbaren Zeiten, mit Vorschau, Lauf-Historie und Doppelabrechnungs-Schutz.

**Architecture:** Neue Seite „Abrechnung": Vorschau je Firma (pure Berechnungslogik über bestehende `contracts`/`time_entries`), Entwurf-Erzeugung über eine Erweiterung des vorhandenen `LexofficeClient` (`POST /v1/invoices` ohne finalize = Entwurf). Jeder Lauf wird als `billing_run` gespeichert; die Zeiteinträge referenzieren den Lauf (`billingRunId`, `ON DELETE SET NULL`) — „Lauf verwerfen" löscht den Lauf und gibt die Zeiten automatisch wieder frei.

**Tech Stack:** Bestehender Stack unverändert; lexoffice Public API v1 (`POST /invoices`).

## Abgestimmte Entscheidungen (Grill-Interview 17.07.2026)

- **Scope:** Nur Rechnungsentwürfe. RMM-Alerts bleiben geparkt (Stufe 5).
- **Stundensatz netto, global als Standard** (auf der Abrechnungsseite pflegbar), **je Firma überschreibbar** (Feld in der Firmen-Akte).
- **Minuten exakt:** Monatssumme der abrechenbaren Minuten je Firma, als Stunden mit 2 Nachkommastellen (kaufmännisch gerundet). Keine Aufrundungs-Taktung.
- **Positionen:** je aktivem Vertrag mit Pauschale > 0 eine Position („<Titel> — <Monat JJJJ>"); EINE Aufwandsposition „IT-Support nach Aufwand — <Monat JJJJ>" (Menge = Stunden, Einzelnachweis Datum/Ticket/Notiz in der Positionsbeschreibung).
- **Netto + 19 % USt** auf alle Positionen (`taxConditions.taxType = 'net'`).
- **Volle Pauschale** auch bei Vertragsstart/-ende im Monat; Vorschau zeigt Hinweis, Korrektur im lexoffice-Entwurf.
- **Manuell mit Vorschau:** Monat wählen → je Firma Pauschalen/Stunden/Summe prüfen → Entwurf erzeugen. Keine Automatik.
- **Lauf-Historie + Verwerfen:** `billing_runs` speichert Firma/Monat/lexoffice-Entwurfs-ID/Summe; zugeordnete Zeiten sind gesperrt; Verwerfen gibt frei (Entwurf in lexoffice löscht Manuel selbst).

## Global Constraints

Alle Konventionen aus `CLAUDE.md` (TDD, Runes, Form Actions, zod-deutsch, `db`-Parameter, Design-Tokens, Cent/ISO-Datum, autofixer, zentraler Guard). Zusätzlich:

- lexoffice nur über das `LexofficeClient`-Interface; Tests mocken `fetch` bzw. den Client — nie echte API. Entwürfe erzeugen heißt `POST /v1/invoices` OHNE `finalize`-Parameter.
- Entwürfe nur für Firmen mit `lexofficeContactId`; Firmen mit abrechenbaren Posten ohne Zuordnung erscheinen rot in der Vorschau, ohne Erzeugen-Knopf.
- Nur Verträge mit `status = 'active'` und `monthlyFeeCents > 0` und `startDate <=` Monatsende zählen als Pauschal-Position.
- Nur `billable = true`-Zeiten mit `billingRunId IS NULL` und `workDate` im Monat zählen zur Aufwandsposition.
- Beträge in Cent; lexoffice erwartet Euro-Floats → Umrechnung NUR an der Client-Grenze (`cents / 100`).

## File Structure (Zielbild Stufe 4)

```
src/lib/
  server/
    db/schema.ts               # + appSettings, billingRuns, companies.hourlyRateCents, timeEntries.billingRunId
    settings.ts                # getSetting / setSetting (app_settings key-value)
    billing/
      preview.ts               # buildBillingPreview(db, month) + Typen
      run.ts                   # createBillingRun / discardBillingRun / listBillingRuns
      draft.ts                 # buildInvoiceDraftPayload (pure) — lexoffice-JSON aus Vorschau
    lexoffice/client.ts        # + createInvoiceDraft(payload) → { id }
  validation/billing.ts        # hourlyRateSchema (EUR-Text → Cent, wie monthlyFee)
src/routes/(app)/
  abrechnung/+page.server.ts,.svelte   # Monat + Standardsatz, Vorschau, Erzeugen, Historie mit Verwerfen
  firmen/[id]/bearbeiten/…             # + Feld „Stundensatz (€, leer = Standard)" via CompanyForm
  +layout.svelte                       # Nav „Abrechnung" (Lucide Receipt)
```

---

### Task 1: Datenmodell Abrechnung

**Files:**
- Modify: `src/lib/server/db/schema.ts`
- Test: `src/lib/server/db/billing-schema.test.ts`
- Create: `src/lib/server/settings.ts` (+ Test `src/lib/server/settings.test.ts`)

**Interfaces:**
- Produces:

```ts
// companies: neue Spalte
hourlyRateCents: integer('hourly_rate_cents')  // null = globaler Standard

// timeEntries: neue Spalte
billingRunId: uuid('billing_run_id').references(() => billingRuns.id, { onDelete: 'set null' })

export const appSettings = pgTable('app_settings', {
	key: text('key').primaryKey(),
	value: text('value').notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

export const billingRuns = pgTable('billing_runs', {
	id: uuid('id').primaryKey().defaultRandom(),
	companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
	month: text('month').notNull(), // 'yyyy-MM'
	lexofficeInvoiceId: text('lexoffice_invoice_id').notNull(),
	totalNetCents: integer('total_net_cents').notNull(),
	createdById: text('created_by_id').references(() => user.id, { onDelete: 'set null' }),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (t) => [unique().on(t.companyId, t.month)]);
// Typen: BillingRun, AppSetting

// settings.ts
export async function getSetting(db, key: string): Promise<string | null>;
export async function setSetting(db, key: string, value: string): Promise<void>; // upsert
export const SETTING_HOURLY_RATE = 'billing.hourlyRateCents';
```

- [ ] **Step 1: Fehlschlagende Tests** — Schema: billing_run anlegen; zweiter Lauf gleiche Firma+Monat → unique-Fehler; Lauf löschen → `timeEntries.billingRunId` wird null (SET NULL); Settings: get auf fehlenden Key → null, set + set (upsert) + get.
- [ ] **Step 2: Rot** (`npm test -- billing-schema settings`), **Step 3: implementieren**, **Step 4: Migration** generieren + beide DBs, **Step 5: Grün + Commit** — `feat: datenmodell abrechnungslaeufe und app-settings`

---

### Task 2: Vorschau-Logik

**Files:**
- Create: `src/lib/server/billing/preview.ts`
- Test: `src/lib/server/billing/preview.test.ts`

**Interfaces:**
- Consumes: `getSetting`/`SETTING_HOURLY_RATE` (Task 1).
- Produces:

```ts
export interface BillingPreviewCompany {
	company: Company;
	contracts: { contract: Contract; note: string | null }[]; // note: „Vertragsbeginn am … im Abrechnungsmonat" o. ä.
	timeEntries: TimeEntryForBilling[]; // { id, workDate, ticketNumber, ticketSubject, note, minutes }
	totalMinutes: number;
	hours: number;              // round(totalMinutes / 60 * 100) / 100
	hourlyRateCents: number;    // Firmen-Satz ?? globaler Standard
	laborNetCents: number;      // round(hours * rate)
	flatFeesNetCents: number;   // Summe Pauschalen
	totalNetCents: number;
	missingLexofficeId: boolean;
	alreadyBilled: boolean;     // billing_run für Firma+Monat existiert
}
export async function buildBillingPreview(db, month: string /* 'yyyy-MM' */): Promise<BillingPreviewCompany[]>;
// Nur Firmen, die im Monat Pauschal-Verträge ODER offene abrechenbare Zeiten haben; alphabetisch.
```

- [ ] **Step 1: Fehlschlagende Tests** — Firma mit Vertrag (aktiv, 49900 Cent) + 247 abrechenbaren Minuten → hours 4.12, laborNetCents = round(4.12*9500) bei Satz 9500, totalNet = flat + labor; Firmen-Satz überschreibt Standard; nicht-abrechenbare/fremdmonatige/bereits gelaufene (billingRunId gesetzt) Zeiten zählen nicht; Vertrag mit Start im Monat → note gesetzt; draft-Vertrag zählt nicht; Firma ohne lexofficeContactId → missingLexofficeId true; Firma ohne Posten taucht nicht auf; alreadyBilled true nach vorhandenem Lauf.
- [ ] **Step 2: Rot → implementieren → grün** (Standard-Satz-Fallback 9500, wenn Setting fehlt — dokumentiert als Konstante `DEFAULT_HOURLY_RATE_CENTS = 9500`).
- [ ] **Step 3: Commit** — `feat: abrechnungs-vorschau je firma und monat`

---

### Task 3: Entwurfs-Payload (pure) + lexoffice-Schreibzugriff

**Files:**
- Create: `src/lib/server/billing/draft.ts`
- Modify: `src/lib/server/lexoffice/client.ts` (+ `createInvoiceDraft`)
- Test: `src/lib/server/billing/draft.test.ts`, erweitern: `src/lib/server/lexoffice/client.test.ts`

**Interfaces:**
- Consumes: `BillingPreviewCompany` (Task 2).
- Produces:

```ts
// draft.ts — pure, kein DB/HTTP
export interface LexofficeInvoiceDraft {
	voucherDate: string; // ISO-Datetime (letzter Tag des Monats, 12:00 lokal)
	address: { contactId: string };
	lineItems: {
		type: 'custom';
		name: string;
		description?: string;
		quantity: number;
		unitName: string; // 'Monat' | 'Stunde'
		unitPrice: { currency: 'EUR'; netAmount: number; taxRatePercentage: 19 };
	}[];
	totalPrice: { currency: 'EUR' };
	taxConditions: { taxType: 'net' };
	title: string; // 'Rechnung'
	introduction: string; // 'Leistungszeitraum 01.07.2026 – 31.07.2026'
}
export function buildInvoiceDraftPayload(preview: BillingPreviewCompany, month: string): LexofficeInvoiceDraft;
// Pauschal-Positionen: name '<Vertragstitel> — Juli 2026', quantity 1, unitName 'Monat', netAmount fee/100
// Aufwand (nur wenn Minuten > 0): name 'IT-Support nach Aufwand — Juli 2026', quantity hours,
//   unitName 'Stunde', netAmount rate/100, description = eine Zeile je Eintrag: 'dd.MM.: T-1042 <Notiz> (45 min)'

// client.ts — Erweiterung des LexofficeClient-Interface:
createInvoiceDraft(draft: LexofficeInvoiceDraft): Promise<{ id: string }>;
// POST /v1/invoices (OHNE finalize) mit JSON-Body, Header wie gehabt + 'Content-Type: application/json'
```

- [ ] **Step 1: Fehlschlagende Tests** — draft: Pauschale + Aufwand korrekt gemappt (Euro-Floats, 19 %, Monatsname deutsch, Einzelnachweis-Zeilen, voucherDate = Monatsletzter); ohne Zeiten keine Aufwandsposition; client: POST-Body und URL geprüft, Antwort-id durchgereicht.
- [ ] **Step 2: Rot → implementieren → grün.** (Alle bestehenden Client-Tests bleiben grün — Mock-Objekte in sync.test/ingest brauchen die neue Methode: `createInvoiceDraft: vi.fn()` ergänzen.)
- [ ] **Step 3: Commit** — `feat: lexoffice-rechnungsentwurf (payload + client-schreibzugriff)`

---

### Task 4: Lauf-Verwaltung

**Files:**
- Create: `src/lib/server/billing/run.ts`
- Test: `src/lib/server/billing/run.test.ts`

**Interfaces:**
- Consumes: `buildBillingPreview` (Task 2), `buildInvoiceDraftPayload` + `LexofficeClient.createInvoiceDraft` (Task 3).
- Produces:

```ts
export class BillingError extends Error {}
export async function createBillingRun(db, lex: LexofficeClient, companyId: string, month: string, userId: string | null): Promise<BillingRun>;
// Ablauf: Vorschau für den Monat bauen → Eintrag der Firma suchen (fehlt/missingLexofficeId/alreadyBilled/totalNet 0 → BillingError mit deutscher Meldung)
// → createInvoiceDraft → billing_runs-Insert → alle Vorschau-Zeiteinträge per inArray auf billingRunId setzen.
export async function discardBillingRun(db, runId: string): Promise<void>; // DELETE — SET NULL gibt Zeiten frei
export async function listBillingRuns(db, month?: string): Promise<(BillingRun & { companyName: string })[]>;
```

- [ ] **Step 1: Fehlschlagende Tests** (Mock-Lex): Lauf erzeugt Entwurf + sperrt Zeiten (zweite Vorschau zeigt Firma mit alreadyBilled bzw. ohne die Zeiten); Doppel-Lauf gleiche Firma+Monat → BillingError; ohne lexofficeContactId → BillingError, kein lex-Aufruf; verwerfen → Zeiten wieder in Vorschau; listBillingRuns liefert Firmennamen.
- [ ] **Step 2: Rot → implementieren → grün.** **Step 3: Commit** — `feat: abrechnungslaeufe mit doppel-schutz und verwerfen`

---

### Task 5: UI Abrechnung + Firmen-Stundensatz

**Files:**
- Create: `src/routes/(app)/abrechnung/+page.server.ts`, `+page.svelte`; `src/lib/validation/billing.ts` (+ Test)
- Modify: `src/lib/components/CompanyForm.svelte` (+ Feld Stundensatz), `src/lib/validation/company.ts` (+ `hourlyRate` EUR→Cent wie `monthlyFee`, nullable), `src/routes/(app)/+layout.svelte` (Nav „Abrechnung", Lucide `Receipt`)

**Interfaces:**
- Consumes: alles aus Tasks 1–4.
- `validation/billing.ts`: `hourlyRateSchema` — `{ hourlyRate: '95' | '95,50' }` → Cent > 0, Meldung „Stundensatz prüfen"; `company.ts`: Feld `hourlyRate` optional (leer → null in `hourlyRateCents`).
- **Seite:** GET-Param `monat` (Default Vormonat!), Kopfzeile: Monats-Input + „Standard-Stundensatz (€ netto)"-Inline-Form (Action `setRate` → `setSetting`). Je Vorschau-Firma eine Karte: Pauschal-Positionen (+ Hinweise), Stunden × Satz, Netto-Summe; rot „lexoffice-Kontakt fehlt (in der Firma pflegen)" ohne Knopf; sonst Action `createRun` (Knopf „Entwurf in lexoffice erzeugen", bei `alreadyBilled` ersetzt durch Hinweis). Darunter „Läufe" (Monat gefiltert): Firma, erzeugt am/von, Summe, „Verwerfen" (confirm, Hinweis „Entwurf in lexoffice selbst löschen"). Fehlender API-Key: Hinweis-Banner statt Erzeugen-Knöpfen.
- [ ] **Step 1: Validation-Test rot → grün.**
- [ ] **Step 2: Routen + Components bauen**, `npm run check` + autofixer.
- [ ] **Step 3: Browser-Verifikation** mit Mock-Weg: Zeiten aus dem Demo-Bestand im Vormonat anlegen, Vorschau prüfen (Summen, rote Firma ohne lexoffice-Id), Firmen-Stundensatz setzen → Vorschau ändert sich. Lauf-Erzeugung ohne echten Key: erwartetes Banner. (Echter lexoffice-Test folgt, wenn Manuels Key da ist.)
- [ ] **Step 4: Commit** — `feat: abrechnungsseite mit vorschau, laeufen und stundensaetzen`

---

### Task 6: Doku + Abschluss

**Files:**
- Modify: `README.md` (Abrechnungs-Abschnitt), `CLAUDE.md` (eine Zeile: Cent→Euro nur an der lexoffice-Grenze; Abrechnung sperrt Zeiten über billingRunId), `docs/PROJEKT.md` (Stufe 4 → Status)

- [ ] **Step 1: Doku.** **Step 2: Gesamtverifikation** (`npm test`, `check`, `build`, Docker-Build). **Step 3: Merge `stufe-4-abrechnung` → `main`, Push, Memory.**

## Bewusst NICHT in Stufe 4

Automatischer Monatslauf (Cron), Festschreiben/Versand aus dem Tool, anteilige Pauschalen, Sätze je Tätigkeit/Vertrag, Rabatte, RMM-Alerts (Stufe 5).
