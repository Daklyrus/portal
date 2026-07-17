# Stufe 3: Kundenportal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kundenportal in derselben App: Portal-Logins je Ansprechpartner (Einladung per Mail), Tickets der eigenen Firma einsehen/erstellen/beantworten/bestätigen, Rechnungen aus lexoffice (stündlicher Sync, PDF on-demand), freigegebene Verträge und Dokumente.

**Architecture:** Eigene Route-Gruppe `(portal)` mit schlankem Kunden-Layout und hartem Rollen-Guard (`role='customer'` + Firmen-Bindung über die Tabelle `portal_access`). Portal-Beiträge schreiben in den bestehenden Ticket-Verlauf (kind `inbound`, Auto-Reopen wie beim Mail-Eingang). lexoffice hinter einem mockbaren Client + stündlichem Poller (Muster wie Graph); Rechnungsdaten in eigener Tabelle, PDFs werden beim Klick durchgestreamt. Einladungen nutzen better-auths Passwort-Reset-Mechanik mit Mailversand über den vorhandenen Graph-Client.

**Tech Stack:** Bestehender Stack unverändert; lexoffice Public API v1 über schlanken `fetch`-Wrapper (kein SDK).

## Abgestimmte Entscheidungen (Grill-Interview 16.07.2026)

- Portal-Zugang **je Ansprechpartner** in der Kundenakte aktivierbar (braucht E-Mail am Kontakt); Login fest an dessen Firma gebunden. Mehrere Nutzer je Firma möglich.
- **Einladung per Mail** (Shared Mailbox) mit 48-h-Link zum Passwort-Setzen. Kein Klartext-Passwort.
- **2FA für Kunden optional** (aktivierbar in Portal-Einstellungen); interne 2FA-Pflicht unverändert.
- Portal-Nutzer sehen **alle Tickets ihrer Firma** — ohne interne Notizen, ohne SLA-/Bearbeiter-Interna.
- Kunden können Tickets **erstellen (mit Anhang), antworten, und bei „Gelöst" bestätigen (→ Geschlossen) oder widersprechen (→ In Arbeit)**.
- **Portal schreibt ins Ticket, Mail bleibt führend:** Portal-Beiträge = Kundenantwort im Verlauf (Auto-Reopen), keine Zusatz-Mail; Techniker-Antworten gehen weiter als Mail raus und erscheinen im Portal.
- **lexoffice:** stündlicher Sync in eigene Tabelle (festgeschriebene Rechnungen, letzte 24 Monate, Status Offen/Bezahlt/Überfällig), **PDF on-demand** durchgestreamt, hinter `LEXOFFICE_SYNC=off` bis der API-Key da ist. Zuordnung über `companies.lexofficeContactId` (UI in der Firmen-Akte).
- **Verträge je Vertrag freigebbar** (neues Flag, Standard aus): Titel, Laufzeit, nächste Verlängerung, Leistungen, Pauschale. Dokumente nutzen das vorhandene `sharedWithCustomer`.
- **Eigenes schlankes Portal-Layout, gleiche App/Domain** (Route-Gruppe, kein zweites Deployment).

## Global Constraints

Alle Konventionen aus `CLAUDE.md` gelten (TDD, Runes, Form Actions, zod-deutsch, Serverlogik mit `db`-Parameter, Design-Tokens, Cent/ISO-Datum, `svelte-autofixer`). Zusätzlich:

- **Jede Portal-Query MUSS über die companyId des eingeloggten Portal-Nutzers filtern** — niemals IDs aus der URL vertrauen, ohne die Firmen-Bindung zu prüfen.
- Portal-Nutzer dürfen NIE sehen: Notizen (`kind='note'`), SLA-Daten, Bearbeiter, interne Firmen-/Kontaktverwaltung, andere Firmen.
- lexoffice-Aufrufe nur über das mockbare `LexofficeClient`-Interface; in Tests nie echte API. Rate-Limit beachten (max. 2 req/s → beim Sync `sleep` zwischen Firmen).
- Neue Env-Variablen in `.env.example` + `.env.production.example`: `LEXOFFICE_API_KEY`, `LEXOFFICE_SYNC` (`on`/`off`), `APP_URL` (für Einladungs-Links, z. B. `http://localhost:5173`).
- Neue Rolle: `customer` (better-auth admin-Plugin `role`-Spalte). Interne Nutzer behalten `admin`/`user`.

## File Structure (Zielbild Stufe 3)

```
src/lib/
  server/
    db/schema.ts              # + portalAccess, invoices, contracts.sharedWithCustomer
    portal/
      access.ts               # activatePortalAccess / deactivatePortalAccess / getPortalContext
      tickets.ts              # listPortalTickets, getPortalTicketDetail, createPortalTicket,
                              #   addPortalReply, confirmResolved, reopenTicket
    lexoffice/
      client.ts               # LexofficeClient-Interface + createLexofficeClient
      sync.ts                 # runInvoiceSyncOnce + startInvoiceSync (stündlich)
    auth.ts                   # + sendResetPassword via Graph, resetPasswordTokenExpiresIn 48 h
  validation/portal.ts        # portalTicketSchema, portalReplySchema
  tickets/labels.ts           # + portalStatusLabels (kundengerechte Texte)
src/routes/
  login/+page.server.ts       # Redirect nach Rolle (customer → /portal)
  passwort/+page.svelte,.server.ts   # Passwort setzen/zurücksetzen (better-auth resetPassword, token aus URL)
  (app)/firmen/[id]/…         # Kontaktkarte: Portal-Zugang aktivieren/deaktivieren;
                              #   ContractForm: „Im Portal sichtbar"; bearbeiten: lexofficeContactId
  (portal)/portal/+layout.server.ts,.svelte   # Guard role=customer + Firmen-Kontext, Kunden-Layout
  (portal)/portal/+page.server.ts,.svelte     # Start: offene Tickets/Rechnungen
  (portal)/portal/tickets/…                   # Liste, [id] (Verlauf + Antwort + Bestätigen), neu
  (portal)/portal/tickets/[id]/anhaenge/[attId]/+server.ts
  (portal)/portal/rechnungen/+page.*, [id]/pdf/+server.ts
  (portal)/portal/vertraege/+page.*           # freigegebene Verträge
  (portal)/portal/dokumente/+page.*, [docId]/+server.ts  # freigegebene Dokumente + Download
  (portal)/portal/einstellungen/+page.*       # 2FA optional aktivieren
```

---

### Task 1: Datenmodell Portal

**Files:**
- Modify: `src/lib/server/db/schema.ts`
- Test: `src/lib/server/db/portal-schema.test.ts`

**Interfaces:**
- Produces:

```ts
// contracts: neue Spalte
sharedWithCustomer: boolean('shared_with_customer').default(false).notNull()

export const portalAccess = pgTable('portal_access', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: text('user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
	contactId: uuid('contact_id').notNull().unique().references(() => contacts.id, { onDelete: 'cascade' }),
	companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export const invoiceStatus = pgEnum('invoice_status', ['open', 'paid', 'overdue', 'voided']);

export const invoices = pgTable('invoices', {
	id: uuid('id').primaryKey().defaultRandom(),
	companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
	lexofficeId: text('lexoffice_id').notNull().unique(),
	voucherNumber: text('voucher_number').notNull(),
	voucherDate: date('voucher_date', { mode: 'string' }).notNull(),
	dueDate: date('due_date', { mode: 'string' }),
	totalCents: integer('total_cents').notNull(),
	currency: text('currency').default('EUR').notNull(),
	status: invoiceStatus('status').notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});
// + Typen: PortalAccess, Invoice, NewInvoice; Contract erhält sharedWithCustomer
```

- [ ] **Step 1: Fehlschlagenden Test schreiben** (Muster `tickets-schema.test.ts`): (a) portal_access anlegen; zweiter Zugang für denselben Kontakt → unique-Fehler; (b) Kontakt löschen → Zugang kaskadiert weg; (c) invoice anlegen, doppelte lexofficeId → Fehler; (d) neuer Vertrag hat `sharedWithCustomer === false`.
- [ ] **Step 2: Rot sehen** — `npm test -- portal-schema`.
- [ ] **Step 3: Schema implementieren** (Code oben), Typen exportieren.
- [ ] **Step 4: Migration:** `npx drizzle-kit generate`, migrate auf Haupt- und Test-DB (`DATABASE_URL=$TEST_DATABASE_URL …`).
- [ ] **Step 5: Grün sehen** (kompletter `npm test`) **+ Commit** — `feat: datenmodell portal (zugaenge, rechnungen, vertrags-freigabe)`

---

### Task 2: Portal-Zugänge + Einladung

**Files:**
- Create: `src/lib/server/portal/access.ts`
- Modify: `src/lib/server/auth.ts` (sendResetPassword, Token-Laufzeit 48 h), `.env.example`, `.env.production.example` (+ `APP_URL`)
- Test: `src/lib/server/portal/access.test.ts`

**Interfaces:**
- Consumes: `createAuth`-Factory (bestehend), `GraphClient.sendMail` (Stufe 2).
- Produces (in `access.ts`):

```ts
export interface PortalContext { userId: string; contactId: string; companyId: string; }

// legt better-auth-User (role 'customer', Zufallspasswort) + portal_access an
// und stößt die Einladung an (better-auth requestPasswordReset → sendResetPassword-Hook).
// Fehler mit deutscher Meldung, wenn der Kontakt keine E-Mail hat oder schon Zugang existiert.
export async function activatePortalAccess(db, authInstance, contactId: string): Promise<PortalAccess>;
export async function deactivatePortalAccess(db, contactId: string): Promise<void>; // löscht user (cascade → access, sessions)
export async function getPortalContext(db, userId: string): Promise<PortalContext | undefined>;
export async function getPortalAccessByContact(db, contactIds: string[]): Promise<Map<string, PortalAccess>>;
```

- Implementierung `activatePortalAccess`: Kontakt + E-Mail laden (fail: „Kontakt braucht eine E-Mail-Adresse"); existierender Zugang → Fehler „Zugang existiert bereits"; User über `authInstance.api.signUpEmail` (Instanz mit `allowSignUp: true` — wie Seed) mit `crypto.randomUUID()` als Passwort; danach `role='customer'` per Drizzle-Update; `portal_access`-Zeile; Einladung via `authInstance.api.requestPasswordReset({ body: { email, redirectTo: '/passwort' } })`.
- `auth.ts`: `emailAndPassword.resetPasswordTokenExpiresIn: 60 * 60 * 48`, `sendResetPassword: async ({ user, url }) => …` — sendet über Graph (deutsch: „Ihr Zugang zum Corvion-Portal", Link = `${env.APP_URL}${…url-token-pfad…}`); wenn MS_*-Variablen fehlen → `console.warn` + Link ins Log (Dev-Fallback). Graph-Client lazy erzeugen (Modul-Cache), damit Tests ohne Env laufen.
- [ ] **Step 1: Fehlschlagende Tests** (DB + createAuth mit `requestCookies:false, allowSignUp:true`; sendResetPassword im Test über options-Injektion abfangen oder Log prüfen): aktivieren legt User mit role customer + access an; Kontakt ohne E-Mail → Fehler; doppelt aktivieren → Fehler; deaktivieren entfernt User und Zugang; getPortalContext liefert companyId.
- [ ] **Step 2: Rot sehen → implementieren → grün** (`npm test`).
- [ ] **Step 3: Commit** — `feat: portal-zugaenge mit einladung ueber passwort-reset`

---

### Task 3: Guards, Login-Redirect, Passwort-Seite, Portal-Shell

**Files:**
- Create: `src/routes/passwort/+page.server.ts`, `+page.svelte`; `src/routes/(portal)/portal/+layout.server.ts`, `+layout.svelte`; `src/routes/(portal)/portal/+page.server.ts`, `+page.svelte`
- Modify: `src/routes/login/+page.server.ts` (Redirect nach Rolle + „Passwort vergessen"-Action), `src/routes/login/+page.svelte` (Link), `src/routes/(app)/+layout.server.ts` (customer → `/portal`)

**Interfaces:**
- Consumes: `getPortalContext` (Task 2).
- Produces: `(portal)/portal/+layout.server.ts` gibt `{ portal: PortalContext & { companyName: string }, user }` an alle Portal-Seiten weiter. Interne Guards: `(app)`-Layout wirft `customer` per `redirect(302, '/portal')` raus; Portal-Layout wirft Nicht-`customer` per `redirect(302, '/')` raus und lädt den Firmennamen.
- Login: nach `signInEmail` Rolle aus Session lesen → `redirect(302, role === 'customer' ? '/portal' : '/')`; 2FA-Redirect unverändert (auch Kunden MIT aktivierter 2FA durchlaufen ihn). Action `forgot`: `auth.api.requestPasswordReset` (immer Erfolgsmeldung, egal ob E-Mail existiert — kein User-Enumeration-Leck).
- `/passwort?token=…`: Formular neues Passwort (2×, min. 12 Zeichen, zod), Action ruft `auth.api.resetPassword({ body: { newPassword, token } })`, Erfolg → redirect `/login` mit Hinweis.
- Portal-Layout: Topbar statt Sidebar (Corvion-Wortmarke, Nav: Übersicht/Tickets/Rechnungen/Verträge/Dokumente/Einstellungen, Abmelden), Footer „Corvion · support@corvion.de". Startseite: Kacheln „Offene Tickets" + „Offene Rechnungen" (Rechnungszahl 0, solange Sync aus) + Kurzliste der letzten 5 Tickets.
- [ ] **Step 1: Routen + Guards bauen** (kein neuer Server-Fn-Test — Logik liegt in Task 2; Guards werden im Browser verifiziert). `npm run check` + autofixer.
- [ ] **Step 2: Browser-Verifikation:** Kontakt aktivieren (Task 4 UI noch nicht da → direkt `activatePortalAccess` über Test-Skript/psql vorbereiten oder Task 4 vorziehen), Einladungs-Link aus Dev-Log öffnen, Passwort setzen, Login → landet in `/portal`; interner Admin auf `/portal` → redirect `/`; Kunde auf `/firmen` → redirect `/portal`.
- [ ] **Step 3: Commit** — `feat: portal-shell mit rollen-guards, einladungs- und passwort-flow`

---

### Task 4: Verwaltung in der Kundenakte

**Files:**
- Modify: `src/routes/(app)/firmen/[id]/+page.server.ts` (+ Actions `activatePortal`, `deactivatePortal`; load: `portalAccessByContact`), `src/routes/(app)/firmen/[id]/+page.svelte` (Kontaktkarte: Badge „Portal aktiv" + Button aktivieren/deaktivieren), `src/lib/components/ContractForm.svelte` (Checkbox „Im Portal sichtbar"), `src/lib/validation/contract.ts` (+ `sharedWithCustomer` checkbox-preprocess), `src/routes/(app)/firmen/[id]/bearbeiten/…` + `CompanyForm.svelte` (+ Feld `lexofficeContactId`), `src/lib/validation/company.ts` (+ optionales Feld)
- Test: bestehende Validation-Tests erweitern (`contract.test.ts`: Checkbox on/aus; `company.test.ts`: lexofficeContactId optional)

- [ ] **Step 1: Validation-Tests erweitern → rot → Schemas anpassen → grün.**
- [ ] **Step 2: UI + Actions bauen.** Aktivieren-Action ruft `activatePortalAccess(db, auth, contactId)`; Fehlermeldungen (keine E-Mail etc.) als Form-Fehler an der Kontaktkarte. Vertragskarte zeigt „Portal"-Badge, wenn freigegeben.
- [ ] **Step 3: Browser-Verifikation + Commit** — `feat: portal-verwaltung in der kundenakte (zugang, vertrags-freigabe, lexoffice-id)`

---

### Task 5: Portal-Tickets (Serverlogik)

**Files:**
- Create: `src/lib/server/portal/tickets.ts`, `src/lib/validation/portal.ts`
- Modify: `src/lib/tickets/labels.ts` (+ `portalStatusLabels`)
- Test: `src/lib/server/portal/tickets.test.ts`, `src/lib/validation/portal.test.ts`

**Interfaces:**
- Consumes: `createTicket`, `addMessage`, `setTicketStatus` (Stufe 2), `saveBuffer` (storage), `sanitizeMailHtml` (ingest).
- Produces:

```ts
// validation/portal.ts
export const portalTicketSchema; // subject min 1 'Betreff ist Pflicht', body min 1 'Beschreibung ist Pflicht' (plain textarea)
export const portalReplySchema;  // body min 1 'Antwort darf nicht leer sein'

// server/portal/tickets.ts — ALLE Funktionen prüfen companyId-Bindung!
export async function listPortalTickets(db, companyId: string): Promise<{ ticket: Ticket }[]>; // neueste zuerst
export async function getPortalTicketDetail(db, companyId: string, ticketId: string):
	Promise<{ ticket: Ticket; messages: (TicketMessage & { attachments: TicketAttachment[] })[] } | undefined>;
	// undefined wenn Ticket nicht zur Firma gehört; messages OHNE kind='note'
export async function createPortalTicket(db, ctx: PortalContext, input: { subject: string; body: string }, files: File[]): Promise<Ticket>;
	// createTicket mit companyId+contactId+requesterEmail des Kontakts, Message kind 'inbound',
	// body als escaped <p>-HTML, Anhänge via saveBuffer unter tickets/<id>
export async function addPortalReply(db, ctx: PortalContext, ticketId: string, body: string, files: File[]): Promise<void>;
	// nur wenn Ticket zur Firma gehört; kind 'inbound'; Auto-Reopen bei waiting_customer/resolved
export async function confirmResolved(db, companyId: string, ticketId: string): Promise<void>; // resolved → closed
export async function reopenTicket(db, companyId: string, ticketId: string): Promise<void>;    // resolved → in_progress
```

- [ ] **Step 1: Fehlschlagende Tests** — Firmen-Bindung: fremdes Ticket → undefined/no-op; Notizen tauchen im Detail nicht auf; createPortalTicket setzt Firma/Kontakt und escaped HTML (`<b>` im Text bleibt Text); Reply auf `waiting_customer` reopnet; confirm nur aus `resolved`; Anhang wird gespeichert (Temp-Root wie in ingest.test).
- [ ] **Step 2: Rot → implementieren → grün** (kompletter `npm test`).
- [ ] **Step 3: Commit** — `feat: portal-ticket-serverlogik mit firmen-bindung`

---

### Task 6: Portal-Tickets (UI)

**Files:**
- Create: `src/routes/(portal)/portal/tickets/+page.server.ts`, `+page.svelte`; `tickets/neu/+page.server.ts`, `+page.svelte`; `tickets/[id]/+page.server.ts`, `+page.svelte`; `tickets/[id]/anhaenge/[attId]/+server.ts`

**Interfaces:**
- Consumes: alles aus Task 5, `portalStatusLabels` (kundengerecht: `waiting_customer` → „Wartet auf Ihre Rückmeldung", `new` → „Eingegangen", Rest wie intern), Portal-Kontext aus dem Layout (`await parent()`).
- **Liste:** Tabelle Nummer/Betreff/Status/Letzte Aktivität; Button „Neue Anfrage". **Neu:** Betreff + Beschreibung (Textarea, kein Rich-Text — Kunden schreiben Prosa) + Datei-Input (multiple) → redirect in die neue Anfrage. **Detail:** Verlauf (inbound rechtsbündig „Sie", outbound linksbündig „Corvion", nie Notizen), Antwort-Textarea + Anhänge; bei Status `resolved` prominenter Kasten „Ist Ihr Anliegen gelöst?" mit „Ja, schließen" (`confirmResolved`) und „Nein, es besteht noch Bedarf" (`reopenTicket`). **Anhang-Download:** wie interner Endpoint, zusätzlich Prüfung `ticket.companyId === portal.companyId` UND Message-`kind !== 'note'`.
- [ ] **Step 1: Routen bauen**, `npm run check` + autofixer über alle neuen Svelte-Dateien.
- [ ] **Step 2: Browser-Verifikation als Portal-Nutzer:** Anfrage mit Anhang erstellen → erscheint intern als Ticket der Firma mit Kundenbeitrag; interne Antwort → im Portal sichtbar; Portal-Antwort auf „Gelöst" → Ticket wieder „In Arbeit"; Bestätigen-Flow → „Geschlossen"; fremde Ticket-URL → 404.
- [ ] **Step 3: Commit** — `feat: portal-tickets (liste, anfrage, verlauf, loesungs-bestaetigung)`

---

### Task 7: lexoffice-Client + Rechnungs-Sync

**Files:**
- Create: `src/lib/server/lexoffice/client.ts`, `src/lib/server/lexoffice/sync.ts`
- Modify: `src/hooks.server.ts` (Sync hinter `LEXOFFICE_SYNC=on`), `.env.example` + `.env.production.example` (+ `LEXOFFICE_API_KEY`, `LEXOFFICE_SYNC=off`)
- Test: `src/lib/server/lexoffice/client.test.ts`, `src/lib/server/lexoffice/sync.test.ts`

**Interfaces:**
- Produces (client — fetch mockbar wie GraphClient):

```ts
export interface LexofficeInvoice {
	lexofficeId: string;       // voucherlist id
	voucherNumber: string;
	voucherDate: string;       // ISO yyyy-MM-dd
	dueDate: string | null;
	totalCents: number;        // aus totalAmount (Euro-Float) gerundet
	status: 'open' | 'paid' | 'overdue' | 'voided';
	contactId: string;         // lexoffice-Kontakt-ID
}
export interface LexofficeClient {
	listInvoices(sinceIso: string): Promise<LexofficeInvoice[]>; // voucherlist, alle Seiten, nur voucherType=invoice + voucherStatus open|paid|overdue|voided
	getInvoicePdf(lexofficeId: string): Promise<{ data: ArrayBuffer; fileName: string }>;
}
export function createLexofficeClient(apiKey: string, fetchFn?: typeof fetch): LexofficeClient;
```

- Client-Details: Basis `https://api.lexoffice.io/v1`, Header `Authorization: Bearer <key>`, `Accept: application/json`. `listInvoices`: `GET /voucherlist?voucherType=invoice&voucherStatus=open,paid,overdue,voided&voucherDateFrom=<since>&size=250&page=<n>` — paginieren bis `last: true`; Mapping `totalAmount` (Float Euro) → `Math.round(x*100)`; Status `paidoff` → `paid`. `getInvoicePdf`: `GET /invoices/{id}/document` → `{documentFileId}` → `GET /files/{documentFileId}` (ArrayBuffer, Dateiname aus Content-Disposition oder `rechnung-<nr>.pdf`).
- Produces (sync): `runInvoiceSyncOnce(db, lex: LexofficeClient): Promise<{ synced: number; errors: number }>` — Firmen mit `lexofficeContactId` laden, `listInvoices(vor 24 Monaten)` EINMAL, je Rechnung über `contactId` der Firma zuordnen, `INSERT … ON CONFLICT (lexoffice_id) DO UPDATE` (Status/Betrag/updatedAt); Rechnungen ohne zugeordnete Firma ignorieren. `startInvoiceSync(db, lex, intervalMs = 3_600_000)` — Muster `startTicketSync` (busy-Guard, stop()).
- [ ] **Step 1: Fehlschlagende Client-Tests** (fetch-Mock: Pagination über 2 Seiten, Betrag 499.9 → 49990, paidoff → paid, PDF-Zweischritt) **und Sync-Tests** (DB: legt Rechnungen für zugeordnete Firma an, Update bei Statuswechsel statt Duplikat, ignoriert fremde contactIds).
- [ ] **Step 2: Rot → implementieren → grün.**
- [ ] **Step 3: hooks.server.ts:** Start analog Ticket-Sync (`LEXOFFICE_SYNC === 'on'` + Key vorhanden). **Commit** — `feat: lexoffice-client und stuendlicher rechnungs-sync`

---

### Task 8: Portal — Rechnungen, Verträge, Dokumente, Einstellungen

**Files:**
- Create: `src/routes/(portal)/portal/rechnungen/+page.server.ts`, `+page.svelte`; `rechnungen/[id]/pdf/+server.ts`; `vertraege/+page.server.ts`, `+page.svelte`; `dokumente/+page.server.ts`, `+page.svelte`; `dokumente/[docId]/+server.ts`; `einstellungen/+page.server.ts`, `+page.svelte`
- Test: `src/lib/server/portal/queries.test.ts` (Create: `src/lib/server/portal/queries.ts`)

**Interfaces:**
- Produces (`portal/queries.ts`):

```ts
export async function listPortalInvoices(db, companyId: string): Promise<Invoice[]>; // neueste zuerst, ohne 'voided'
export async function getPortalInvoice(db, companyId: string, invoiceId: string): Promise<Invoice | undefined>;
export async function listSharedContracts(db, companyId: string): Promise<Contract[]>; // nur sharedWithCustomer
export async function listSharedDocuments(db, companyId: string): Promise<Document[]>; // nur sharedWithCustomer
export async function getSharedDocument(db, companyId: string, documentId: string): Promise<Document | undefined>;
```

- **Rechnungen:** Tabelle Nummer/Datum/Fällig/Betrag (`Intl 'de-DE' EUR`)/Status-Badge (Offen amber, Bezahlt emerald, Überfällig destructive) + PDF-Button. `pdf/+server.ts`: `getPortalInvoice` (404 sonst) → `createLexofficeClient(env.LEXOFFICE_API_KEY).getInvoicePdf` → Response mit `Content-Disposition: attachment`; 503 „Rechnungsabruf derzeit nicht möglich" wenn Key fehlt. Leerer Zustand: „Noch keine Rechnungen verfügbar."
- **Verträge:** Karten mit Titel, „läuft seit", nächste Verlängerung (`computeContractDeadlines(...).currentPeriodEnd` + 1 Tag), Kündigungsfrist in Monaten, Leistungen, Pauschale. KEINE SLA-/Fristen-Badges.
- **Dokumente:** Tabelle Name/Größe/Datum + Download über eigenen Endpoint (prüft `sharedWithCustomer` UND `companyId` — den internen Endpoint NICHT wiederverwenden, der prüft keine Freigabe).
- **Einstellungen:** 2FA-Block (Wiederverwendung des Flows der internen Sicherheitsseite: enable → QR + Backup-Codes → verify; disable mit Passwort via `auth.api.disableTwoFactor`), optional — kein Zwang, kein Redirect.
- [ ] **Step 1: Fehlschlagende Query-Tests** (Firmen-Bindung überall: fremde companyId → leer/undefined; voided ausgeblendet; nur freigegebene Verträge/Dokumente).
- [ ] **Step 2: Rot → implementieren → grün.**
- [ ] **Step 3: UI bauen**, autofixer, Browser-Verifikation (Rechnung per SQL einfügen, solange Sync aus; Vertrag freigeben → erscheint; Dokument ohne Freigabe-Flag → unsichtbar + Download-URL 404).
- [ ] **Step 4: Commit** — `feat: portal-rechnungen, -vertraege, -dokumente und einstellungen`

---

### Task 9: Doku + Abschluss

**Files:**
- Modify: `README.md` (Portal-Abschnitt, lexoffice-Key-Anleitung: app.lexoffice.de → Extras → Public API), `CLAUDE.md` (Portal-Konventionen: companyId-Bindung, note-Sperre), `docs/PROJEKT.md` (Stufe 3 → Status)

- [ ] **Step 1: Doku schreiben.**
- [ ] **Step 2: Gesamtverifikation** — `npm test`, `npm run check`, `npm run build`, Docker-Build.
- [ ] **Step 3: Merge `stufe-3-portal` → `main` + Push. Memory aktualisieren.**

## Bewusst NICHT in Stufe 3

Portal-Subdomain, Selbstregistrierung/Nutzerverwaltung durch Kunden, Rechnungs-PDF-Cache, lexoffice-Schreibzugriffe (Rechnungserzeugung bleibt Stufe 4+), Benachrichtigungs-Mails „neue Antwort im Portal" (Mail bleibt führender Kanal), privates Ticket-Flag, Mehrfirmen-Nutzer.
