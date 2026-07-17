# Stufe 2: Ticketsystem — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ticketsystem mit E-Mail-Anbindung über Microsoft Graph (Shared Mailbox support@corvion.de), SLA auf Erstreaktion, Rich-Text-Antworten und einfacher Zeiterfassung mit Monatsreport.

**Architecture:** Ein Poller im App-Prozess liest per Graph-Delta-Query Inbox + Gesendete Elemente der Shared Mailbox. Mails ohne `[#T-…]` im Betreff werden neue Tickets (Auto-Bestätigung mit Nummer), Mails mit Nummer bzw. passender `conversationId` werden dem Ticket-Thread zugeordnet. Antworten gehen per Graph `sendMail` als support@corvion.de raus. Alles hinter dem bestehenden Auth-Guard; Serverlogik als testbare Funktionen mit `db`-Parameter, Graph-Aufrufe hinter einem mockbaren Client.

**Tech Stack:** Bestehender Stack (SvelteKit 2/Svelte 5, Drizzle, Vitest) + `@tiptap/core`/`@tiptap/starter-kit`/`@tiptap/extension-link` (Editor), `sanitize-html` (eingehende Mails), Microsoft Graph REST v1.0 (kein SDK — schlanker `fetch`-Wrapper).

## Abgestimmte Entscheidungen (Grill-Interview 16.07.2026)

- Mail ohne `[#T-…]` → neues Ticket; mit Nummer → Antwort; Fallback-Matching über `conversationId`. Auto-Eingangsbestätigung bei jedem neuen Ticket.
- Absender unbekannt → Ticket ohne Firma (UI: rot markiert, manuell zuordnen, dabei optional Kontakt anlegen).
- Polling per Delta-Query (Intervall 90 s), kein Webhook. Verarbeitete Inbox-Mails → Unterordner „Im Tool". Gesendet-Ordner wird mitgelesen (Outlook-Antworten mit Nummer landen im Ticket). Kein Alt-Import.
- Status: Neu → In Arbeit → Wartet auf Kunde → Gelöst → Geschlossen; Auto-Reopen (→ In Arbeit) bei Kundenantwort auf „Wartet auf Kunde"/„Gelöst".
- Priorität Normal/Hoch/Kritisch. SLA nur Erstreaktion, global je Priorität (Kritisch 2 h, Hoch 4 h, Normal 8 h), Geschäftszeiten Mo–Fr 08–17 Uhr, NRW-Feiertage.
- Editor: Tiptap mit Fett/Kursiv/Listen/Links/Code-Block/Überschriften. Keine Tabellen/Farben (Architektur offen halten).
- Anhänge am Ticket-Beitrag, gleiche Storage-Schutzmechanik wie Dokumente (25 MB, Blocklist, UUID-Pfade).
- Interne Notizen (gehen nie raus). Manuelle Tickets inkl. proaktiver Erst-Mail. Ticketnummern fortlaufend ab T-1001.
- Zeiterfassung: Minuten + Notiz + abrechenbar + Datum je Eintrag; Monatsliste je Firma mit Summen (abrechenbar/nicht getrennt).
- Dashboard: Neu-Zähler + SLA-Ampel. Keine Mail-/Teams-Benachrichtigungen.

## Global Constraints

Alle Konventionen aus `CLAUDE.md` gelten unverändert, insbesondere:

- **TDD:** Test rot → implementieren → grün → Commit (Conventional Commits, deutsch).
- **Svelte 5 Runes only**, Links über `resolve()` mit Gruppen-Route-IDs, vor Abschluss `npx @sveltejs/mcp svelte-autofixer <datei>`.
- **Form Actions statt API-Routen**; zod in `src/lib/validation/` (deutsche Meldungen); Serverlogik in `src/lib/server/` nimmt `db` als Parameter.
- **Design-Tokens** aus `src/routes/layout.css`, Lucide-Icons, deutsche UI-Texte (stop-slop).
- **Geld in Cent, Datum als ISO-String**; Zeiten hier in **Minuten (integer)**.
- Graph-Aufrufe NIE direkt in Routen/Ingest — immer über `GraphClient`-Interface (mockbar).
- Neue Env-Variablen in `.env.example` + `.env.production.example` pflegen: `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `SUPPORT_MAILBOX`, `TICKET_SYNC` (`on`/`off`).
- Integrationstests gegen `corvion_test` (seriell, wie gehabt); Graph in Tests immer gemockt — nie echte API.

## File Structure (Zielbild Stufe 2)

```
src/lib/
  tickets/
    sla.ts                     # Pure: Geschäftszeiten, NRW-Feiertage, SLA-Fälligkeit
    subject.ts                 # Pure: [#T-1042] parsen/anhängen
  validation/
    ticket.ts                  # zod: manuelles Ticket, Antwort/Notiz, Statuswechsel
    timeEntry.ts               # zod: Zeiteintrag
  server/
    db/schema.ts               # + tickets, ticket_messages, ticket_attachments, time_entries, sync_state
    graph/client.ts            # GraphClient-Interface + createGraphClient (Token, Mail-Ops)
    tickets/
      ingest.ts                # processInboxMessage / processSentMessage
      outbound.ts              # Antwort/Erst-Mail/Bestätigung senden + persistieren
      tickets.ts               # CRUD, Statuswechsel, Zuordnung, Listen-Query
      poller.ts                # startTicketSync (Intervall, Delta-Tokens in sync_state)
    time-entries.ts            # CRUD + Monatsreport-Query
  components/
    RichTextEditor.svelte      # Tiptap-Wrapper (hidden input mit HTML)
    TicketStatusBadge.svelte   # Status + Priorität + SLA-Ampel-Badges
src/routes/(app)/
  tickets/+page.server.ts,.svelte        # Liste mit Filtern
  tickets/neu/…                          # Manuell anlegen (+ optionale Erst-Mail)
  tickets/[id]/…                         # Thread, Antwort, Notiz, Status, Zeit, Zuordnung
  tickets/[id]/anhaenge/[attId]/+server.ts  # Attachment-Download
  berichte/zeiten/…                      # Monatsliste je Firma
docs/entra-id-setup.md         # Anleitung App-Registrierung (für Manuel)
src/hooks.server.ts            # + startTicketSync()-Aufruf
```

---

### Task 1: Datenmodell Tickets

**Files:**
- Modify: `src/lib/server/db/schema.ts`
- Test: `src/lib/server/db/tickets-schema.test.ts`

**Interfaces:**
- Produces: Tabellen `tickets` (u. a. `number` integer unique ab 1001 via Sequence, `status`/`priority` pgEnum, `companyId`/`contactId`/`assignedToId` nullable, `conversationId`, `firstRespondedAt`), `ticketMessages` (`kind` pgEnum `'inbound'|'outbound'|'note'`, `bodyHtml`, `graphMessageId` unique nullable, `internetMessageId`), `ticketAttachments`, `timeEntries` (`minutes`, `billable`, `workDate`), `syncState` (`key` pk, `value`). Typen `Ticket`, `NewTicket`, `TicketMessage`, `TimeEntry` etc. via `$inferSelect/$inferInsert`.

- [ ] **Step 1: Fehlschlagenden Test schreiben** — `tickets-schema.test.ts` analog `schema.test.ts` (postgres-Client auf `TEST_DATABASE_URL`, `beforeEach` löscht `companies` + `tickets`): (a) Ticket anlegen → `number` ≥ 1001, zweites Ticket → `number` +1; (b) Message + Attachment + TimeEntry anlegen, Ticket löschen → alles kaskadiert weg; (c) Firma eines Tickets löschen → Ticket bleibt, `companyId` ist null.
- [ ] **Step 2: Rot sehen** — `npm test -- tickets-schema` → FAIL (Tabellen fehlen).
- [ ] **Step 3: Schema implementieren** — in `schema.ts`:

```ts
export const ticketStatus = pgEnum('ticket_status', ['new', 'in_progress', 'waiting_customer', 'resolved', 'closed']);
export const ticketPriority = pgEnum('ticket_priority', ['normal', 'high', 'critical']);
export const messageKind = pgEnum('message_kind', ['inbound', 'outbound', 'note']);

export const ticketNumberSeq = pgSequence('ticket_number_seq', { startWith: 1001 });

export const tickets = pgTable('tickets', {
	id: uuid('id').primaryKey().defaultRandom(),
	number: integer('number').notNull().unique().default(sql`nextval('ticket_number_seq')`),
	subject: text('subject').notNull(),
	status: ticketStatus('status').default('new').notNull(),
	priority: ticketPriority('priority').default('normal').notNull(),
	companyId: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),
	contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
	assignedToId: text('assigned_to_id').references(() => user.id, { onDelete: 'set null' }),
	requesterEmail: text('requester_email'),
	requesterName: text('requester_name'),
	conversationId: text('conversation_id'),
	firstRespondedAt: timestamp('first_responded_at', { withTimezone: true }),
	closedAt: timestamp('closed_at', { withTimezone: true }),
	...timestamps
});

export const ticketMessages = pgTable('ticket_messages', {
	id: uuid('id').primaryKey().defaultRandom(),
	ticketId: uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
	kind: messageKind('kind').notNull(),
	authorId: text('author_id').references(() => user.id, { onDelete: 'set null' }),
	fromEmail: text('from_email'),
	toEmails: text('to_emails'),
	subject: text('subject'),
	bodyHtml: text('body_html').notNull(),
	graphMessageId: text('graph_message_id').unique(),
	internetMessageId: text('internet_message_id'),
	sentAt: timestamp('sent_at', { withTimezone: true }),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export const ticketAttachments = pgTable('ticket_attachments', {
	id: uuid('id').primaryKey().defaultRandom(),
	messageId: uuid('message_id').notNull().references(() => ticketMessages.id, { onDelete: 'cascade' }),
	fileName: text('file_name').notNull(),
	storagePath: text('storage_path').notNull(),
	mimeType: text('mime_type').notNull(),
	sizeBytes: integer('size_bytes').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export const timeEntries = pgTable('time_entries', {
	id: uuid('id').primaryKey().defaultRandom(),
	ticketId: uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
	userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
	minutes: integer('minutes').notNull(),
	note: text('note'),
	billable: boolean('billable').default(true).notNull(),
	workDate: date('work_date', { mode: 'string' }).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export const syncState = pgTable('sync_state', {
	key: text('key').primaryKey(),
	value: text('value').notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});
```

Plus Import `sql` aus `drizzle-orm`, `pgSequence` aus `drizzle-orm/pg-core`, Export der Typen (`Ticket`, `NewTicket`, `TicketMessage`, `NewTicketMessage`, `TicketAttachment`, `TimeEntry`, `NewTimeEntry`).

- [ ] **Step 4: Migration erzeugen + beide DBs migrieren** — `npx drizzle-kit generate`, dann `npx drizzle-kit migrate` und `DATABASE_URL=$TEST_DATABASE_URL npx drizzle-kit migrate` (URL aus `.env`). Prüfen: `\dt` zeigt neue Tabellen, `\ds` die Sequence.
- [ ] **Step 5: Grün sehen** — `npm test -- tickets-schema` → PASS; danach `npm test` komplett.
- [ ] **Step 6: Commit** — `git commit -m "feat: datenmodell tickets (nachrichten, anhaenge, zeiten, sync-state)"`

---

### Task 2: SLA- und Betreff-Logik (pure)

**Files:**
- Create: `src/lib/tickets/sla.ts`, `src/lib/tickets/subject.ts`
- Test: `src/lib/tickets/sla.test.ts`, `src/lib/tickets/subject.test.ts`

**Interfaces:**
- Produces:
  - `SLA_RESPONSE_MINUTES: Record<'normal'|'high'|'critical', number>` = `{ critical: 120, high: 240, normal: 480 }` (Geschäftsminuten)
  - `computeSlaDueAt(createdAt: Date, priority: TicketPriority): Date` — addiert Geschäftsminuten (Mo–Fr 08:00–17:00 Europe/Berlin, NRW-Feiertage übersprungen)
  - `slaStatus(t: { createdAt: Date; firstRespondedAt: Date | null; priority; status }, now: Date): 'met' | 'due_soon' | 'overdue' | 'pending'` — `met` wenn `firstRespondedAt` vor Fälligkeit; `due_soon` wenn < 25 % der Frist übrig; `closed`/`resolved` ohne Antwort → `pending`
  - `nrwHolidays(year: number): string[]` (ISO-Daten; Gauß-Osterformel für bewegliche Feiertage inkl. Fronleichnam)
  - `parseTicketNumber(subject: string): number | null` — findet `[#T-1042]` case-insensitiv irgendwo im Betreff
  - `subjectWithNumber(subject: string, number: number): string` — hängt ` [#T-1042]` an, falls nicht vorhanden
- [ ] **Step 1: Fehlschlagende Tests schreiben** — Fälle: Fälligkeit über Nacht (Fr 16:30 + 120 min → Mo 09:30), Feiertag (Ticket 30.04. 16:00, Normal 480 min → 1. Mai übersprungen), Wochenend-Eingang startet Mo 08:00; `slaStatus` alle vier Zweige; `parseTicketNumber('Re: Drucker [#T-1042]') === 1042`, `parseTicketNumber('Drucker kaputt') === null`, `subjectWithNumber` idempotent.
- [ ] **Step 2: Rot sehen** — `npm test -- src/lib/tickets` → FAIL (Module fehlen).
- [ ] **Step 3: Implementieren** — Geschäftsminuten-Iteration tageweise (date-fns), Feiertagsliste NRW: Neujahr, Karfreitag, Ostermontag, 1. Mai, Christi Himmelfahrt, Pfingstmontag, Fronleichnam, 3. Oktober, Allerheiligen, 1./2. Weihnachtstag.
- [ ] **Step 4: Grün sehen** — `npm test -- src/lib/tickets` → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: sla-geschaeftszeiten-logik und ticketnummern-parsing"`

---

### Task 3: Graph-Client

**Files:**
- Create: `src/lib/server/graph/client.ts`
- Test: `src/lib/server/graph/client.test.ts`
- Modify: `.env.example`, `.env.production.example` (+ `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `SUPPORT_MAILBOX=support@corvion.de`, `TICKET_SYNC=off`)

**Interfaces:**
- Produces (alles, was Ingest/Outbound/Poller brauchen — Tests übergeben ein handgebautes Mock-Objekt dieses Interfaces):

```ts
export interface GraphMessage {
	id: string;
	internetMessageId: string;
	conversationId: string;
	subject: string;
	from: { name: string; address: string };
	toRecipients: string[];
	body: { contentType: 'html' | 'text'; content: string };
	receivedDateTime: string;
	hasAttachments: boolean;
}

export interface GraphAttachment {
	name: string;
	contentType: string;
	size: number;
	contentBytes: string; // base64
}

export interface OutgoingMail {
	subject: string;
	html: string;
	to: string[];
	attachments?: { name: string; contentType: string; contentBytes: string }[];
}

export interface GraphClient {
	deltaMessages(folder: 'inbox' | 'sentitems', deltaLink: string | null):
		Promise<{ messages: GraphMessage[]; deltaLink: string }>;
	getAttachments(messageId: string): Promise<GraphAttachment[]>;
	sendMail(mail: OutgoingMail): Promise<void>;
	moveToFolder(messageId: string, folderName: string): Promise<void>; // legt Ordner bei Bedarf an
}

export function createGraphClient(env: {
	MS_TENANT_ID: string; MS_CLIENT_ID: string; MS_CLIENT_SECRET: string; SUPPORT_MAILBOX: string;
}, fetchFn?: typeof fetch): GraphClient;
```

- Implementierungsdetails: Token per Client-Credentials (`https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token`, Scope `https://graph.microsoft.com/.default`), im Speicher gecacht bis 5 min vor Ablauf. Basis-URL `https://graph.microsoft.com/v1.0/users/{SUPPORT_MAILBOX}`. Delta: `/mailFolders/{folder}/messages/delta?$select=…` — beim ersten Aufruf ohne `deltaLink` NUR den finalen `@odata.deltaLink` übernehmen und Nachrichten verwerfen (kein Alt-Import!). `moveToFolder` cached Folder-IDs, legt „Im Tool" per `POST /mailFolders` an, wenn 404. `sendMail` via `POST /sendMail` (`saveToSentItems: true`).
- [ ] **Step 1: Fehlschlagende Tests** — `fetchFn` als Vitest-Mock: (a) Token wird geholt und bei zweitem Aufruf wiederverwendet (nur 1 Token-Request); (b) `deltaMessages` folgt `@odata.nextLink` bis `deltaLink` und liefert alle Messages gesammelt; (c) Erstlauf ohne deltaLink liefert `messages: []`; (d) `sendMail` postet korrektes JSON (Empfänger, HTML-Body); (e) 401 → ein Retry mit frischem Token.
- [ ] **Step 2: Rot sehen** — `npm test -- graph` → FAIL.
- [ ] **Step 3: Implementieren** (reines `fetch`, kein SDK).
- [ ] **Step 4: Grün sehen**, danach `npm run check`.
- [ ] **Step 5: Commit** — `git commit -m "feat: graph-client fuer shared mailbox (delta, sendmail, ordner)"`

---

### Task 4: Ingest-Pipeline

**Files:**
- Create: `src/lib/server/tickets/ingest.ts`, `src/lib/server/tickets/tickets.ts`
- Test: `src/lib/server/tickets/ingest.test.ts`
- Modify: `package.json` (`npm i sanitize-html && npm i -D @types/sanitize-html`)

**Interfaces:**
- Consumes: `GraphClient`, `GraphMessage` (Task 3), `parseTicketNumber`/`subjectWithNumber` (Task 2), `saveUpload`-Mechanik: neuer Export `saveBuffer(buffer: Buffer, fileName: string, subdir: string, root?: string): Promise<StoredFile>` in `storage.ts` (gleiche Limits/Prüfungen wie `saveUpload`, Refactor: `saveUpload` ruft intern `saveBuffer`).
- Produces (in `tickets.ts`):

```ts
export async function createTicket(db, input: { subject: string; priority?: TicketPriority; companyId?: string | null; contactId?: string | null; requesterEmail?: string | null; requesterName?: string | null; conversationId?: string | null }): Promise<Ticket>;
export async function addMessage(db, ticketId: string, input: NewTicketMessageLike): Promise<TicketMessage>;
export async function findTicketByNumber(db, number: number): Promise<Ticket | undefined>;
export async function findTicketByConversationId(db, conversationId: string): Promise<Ticket | undefined>; // nur nicht-geschlossene, neueste zuerst
export async function findContactByEmail(db, email: string): Promise<(Contact & { company: Company }) | undefined>;
export async function setTicketStatus(db, id: string, status: TicketStatus): Promise<void>; // setzt closedAt bei 'closed'
export async function markFirstResponse(db, id: string, at: Date): Promise<void>; // nur wenn noch null
```

- Produces (in `ingest.ts`):

```ts
export async function processInboxMessage(db, graph: GraphClient, msg: GraphMessage): Promise<'created' | 'appended' | 'skipped'>;
export async function processSentMessage(db, graph: GraphClient, msg: GraphMessage): Promise<'appended' | 'skipped'>;
export function buildConfirmationMail(ticket: Ticket): OutgoingMail; // Betreff: subjectWithNumber('Re: '+subject), deutscher Text
```

- Ablauf `processInboxMessage`: (1) Dedupe: existiert `graphMessageId` → `skipped`. (2) Eigene Adresse als Absender (`SUPPORT_MAILBOX`) → `skipped`. (3) `parseTicketNumber(subject)` → Ticket; sonst `findTicketByConversationId`. (4a) Treffer: `addMessage(kind:'inbound', bodyHtml: sanitize(...))`, Anhänge via `getAttachments`+`saveBuffer` (Fehler je Anhang: überspringen, im Body-Anfang als Hinweis-Absatz vermerken), Auto-Reopen wenn Status `waiting_customer`/`resolved`. (4b) Kein Treffer: `findContactByEmail` → `createTicket` (+company/contact oder null), Message anhängen, `graph.sendMail(buildConfirmationMail(ticket))` + Bestätigung als outbound-Message persistieren. (5) `graph.moveToFolder(msg.id, 'Im Tool')`. Sanitize-Konfig: `sanitize-html` mit erlaubten Tags (p, br, div, span, a[href], ul/ol/li, b/strong, i/em, h1–h4, pre, code, blockquote, img[src nur cid:/https]), Styles raus.
- Ablauf `processSentMessage`: Dedupe; nur wenn `parseTicketNumber` ODER `conversationId` ein Ticket trifft → `addMessage(kind:'outbound', fromEmail: SUPPORT_MAILBOX)`; nie Auto-Reply, nie verschieben; sonst `skipped`.
- [ ] **Step 1: Fehlschlagende Tests** (DB-Integration, Graph als Mock-Objekt mit Vitest-Spies): neue Mail unbekannter Absender → Ticket ohne Firma + Bestätigung gesendet + verschoben; bekannter Kontakt (vorher via `createCompany`/`createContact` angelegt) → Firma zugeordnet; Antwort mit `[#T-…]` → appended statt neues Ticket; `conversationId`-Fallback; Duplikat (gleiche `graphMessageId` zweimal) → einmal verarbeitet; Auto-Reopen aus `resolved`; Sent-Message mit Nummer → outbound appended, ohne Bezug → skipped; HTML mit `<script>` wird bereinigt.
- [ ] **Step 2: Rot sehen** — `npm test -- ingest` → FAIL.
- [ ] **Step 3: Implementieren** (inkl. `saveBuffer`-Refactor in `storage.ts` — bestehende Storage-Tests müssen unverändert grün bleiben).
- [ ] **Step 4: Grün sehen** — kompletter `npm test`.
- [ ] **Step 5: Commit** — `git commit -m "feat: mail-ingest mit threading, auto-bestaetigung und anhaengen"`

---

### Task 5: Poller

**Files:**
- Create: `src/lib/server/tickets/poller.ts`
- Test: `src/lib/server/tickets/poller.test.ts`
- Modify: `src/hooks.server.ts`

**Interfaces:**
- Consumes: `processInboxMessage`/`processSentMessage` (Task 4), `GraphClient` (Task 3), `syncState`-Tabelle (Task 1).
- Produces:

```ts
export async function runSyncOnce(db, graph: GraphClient): Promise<{ processed: number; errors: number }>;
export function startTicketSync(db, graph: GraphClient, intervalMs = 90_000): () => void; // gibt stop() zurück, überlappende Läufe verhindert
```

- `runSyncOnce`: Delta-Link aus `sync_state` (Keys `delta:inbox`, `delta:sentitems`) lesen → `deltaMessages` → jede Message durch die Pipeline (Fehler je Message: `console.error` mit Betreff, weiterzählen, Rest läuft weiter) → neuen Delta-Link speichern (nur bei Erfolg des Folder-Durchlaufs).
- `hooks.server.ts`: nach den bestehenden Imports — wenn `!building && env.TICKET_SYNC === 'on'` → `startTicketSync(db, createGraphClient(env))` einmalig auf Modulebene (Guard über Modul-Variable).
- [ ] **Step 1: Fehlschlagende Tests** — `runSyncOnce` mit Mock-Graph: verarbeitet Inbox+Sent, persistiert Delta-Links (zweiter Lauf übergibt gespeicherten Link), einzelne Message wirft → andere trotzdem verarbeitet, `errors` gezählt, Delta-Link trotzdem gespeichert; `startTicketSync` mit `vi.useFakeTimers()`: tickt, überlappt nicht (zweiter Tick während laufendem ersten wird übersprungen), `stop()` beendet.
- [ ] **Step 2: Rot sehen.**
- [ ] **Step 3: Implementieren.**
- [ ] **Step 4: Grün sehen** + `npm run check`.
- [ ] **Step 5: Commit** — `git commit -m "feat: ticket-sync-poller mit delta-links und fehlertoleranz"`

---

### Task 6: Outbound-Mails + Rich-Text-Editor

**Files:**
- Create: `src/lib/server/tickets/outbound.ts`, `src/lib/components/RichTextEditor.svelte`, `src/lib/validation/ticket.ts`
- Test: `src/lib/server/tickets/outbound.test.ts`, `src/lib/validation/ticket.test.ts`
- Modify: `package.json` (`npm i @tiptap/core @tiptap/starter-kit @tiptap/extension-link`)

**Interfaces:**
- Consumes: `GraphClient.sendMail` (Task 3), `addMessage`/`markFirstResponse`/`setTicketStatus` (Task 4), `subjectWithNumber` (Task 2).
- Produces (in `outbound.ts`):

```ts
export const MAIL_SIGNATURE_HTML: string; // "Mit freundlichen Grüßen<br>Ihr Corvion-Team<br>support@corvion.de"
export function wrapOutboundHtml(bodyHtml: string): string; // Body + <hr>-getrennte Signatur, inline-sicheres Grundlayout (font-family sans-serif)
export async function sendTicketReply(db, graph: GraphClient, opts: {
	ticket: Ticket; authorId: string; bodyHtml: string; to: string; setStatus?: TicketStatus;
}): Promise<TicketMessage>;
// Ablauf: sanitize(bodyHtml) → sendMail({ subject: subjectWithNumber('Re: '+ticket.subject, ticket.number), html: wrapOutboundHtml(...), to })
// → addMessage(kind:'outbound', authorId, sentAt: now) → markFirstResponse(ticket.id, now) → optional setTicketStatus
```

- Produces (in `validation/ticket.ts`): `manualTicketSchema` (subject Pflicht „Betreff ist Pflicht", priority enum, companyId/contactId optional-uuid, initialMailHtml + to optional — wenn `to` gesetzt, muss es eine E-Mail sein), `replySchema` (bodyHtml min 1 „Antwort darf nicht leer sein", to E-Mail, setStatus optional enum), `noteSchema` (bodyHtml min 1), `statusSchema`, `assignSchema` (companyId uuid, contactId optional, `saveContact` boolean + Namensfelder optional).
- Produces (`RichTextEditor.svelte`): Props `{ name: string; initialHtml?: string; placeholder?: string }`. Tiptap mit StarterKit (Headings 1–3, Bold, Italic, BulletList, OrderedList, CodeBlock, Blockquote) + Link-Extension; schlanke Toolbar (Lucide-Icons, Token-Farben); synchronisiert HTML in `<input type="hidden" {name}>`, damit die normale Form Action ihn liest. `$effect`-basiertes Mount/Destroy, kein SSR-Zugriff aufs DOM (`import { browser }`-Guard unnötig, Editor im `$effect` erzeugen).
- [ ] **Step 1: Fehlschlagende Tests** — outbound (DB + Mock-Graph): sendet mit `[#T-…]`-Betreff, persistiert outbound-Message, setzt `firstRespondedAt` nur beim ersten Mal, optionaler Statuswechsel, `<script>` im Body wird entfernt; validation: alle Schemas happy/sad path.
- [ ] **Step 2: Rot sehen.**
- [ ] **Step 3: Implementieren** (Editor-Component ohne Test — wird in Task 7 im Browser verifiziert; `svelte-autofixer` Pflicht).
- [ ] **Step 4: Grün sehen** + `npm run check`.
- [ ] **Step 5: Commit** — `git commit -m "feat: ticket-antworten per graph-sendmail und tiptap-editor"`

---

### Task 7: Tickets-UI

**Files:**
- Create: `src/routes/(app)/tickets/+page.server.ts`, `+page.svelte`; `tickets/neu/+page.server.ts`, `+page.svelte`; `tickets/[id]/+page.server.ts`, `+page.svelte`; `tickets/[id]/anhaenge/[attId]/+server.ts`; `src/lib/components/TicketStatusBadge.svelte`
- Modify: `src/routes/(app)/+layout.svelte` (Nav-Eintrag „Tickets", Lucide `Ticket`), `src/routes/(app)/+page.server.ts` + `+page.svelte` (Dashboard-Widget), `src/lib/server/tickets/tickets.ts` (Listen-Query)

**Interfaces:**
- Consumes: alles aus Tasks 2–6.
- Produces (Ergänzung `tickets.ts`):

```ts
export interface TicketListItem { ticket: Ticket; company: Company | null; assignee: { id: string; name: string } | null; sla: ReturnType<typeof slaStatus>; }
export async function listTickets(db, filter: { status?: TicketStatus | 'open'; priority?: TicketPriority; assignedToId?: string }, now: Date): Promise<TicketListItem[]>;
// 'open' = alles außer resolved/closed; Sortierung: overdue → due_soon → Rest, dann Priorität, dann createdAt
export async function getTicketDetail(db, id: string): Promise<{ ticket: Ticket; company: Company | null; contact: Contact | null; messages: (TicketMessage & { attachments: TicketAttachment[]; author: { name: string } | null })[]; } | undefined>;
export async function assignTicketCompany(db, ticketId: string, opts: { companyId: string; contactId?: string | null }): Promise<void>;
export async function listInternalUsers(db): Promise<{ id: string; name: string }[]>;
```

- **Liste:** Filterleiste (GET-Form: Status-Select inkl. „Offen (alle)", Priorität, Bearbeiter), Tabelle: Nummer `T-1042`, Betreff (Link), Firma (oder rotes „Nicht zugeordnet"), Status-Badge, Prio, SLA-Ampel (`TicketStatusBadge`: overdue = destructive, due_soon = amber, met = emerald, pending neutral + „Antwort bis {Datum Uhrzeit}"), Bearbeiter, Alter.
- **Detail:** Kopf (Nummer, Betreff, Badges, Selects für Status/Priorität/Bearbeiter als Mini-Form-Actions mit sofortigem Submit `onchange`), roter Zuordnungs-Kasten wenn `companyId` null (Firma-Select + optional „Absender als Ansprechpartner speichern" mit Vor-/Nachname-Feldern), Thread chronologisch (inbound weiß / outbound blau getönt / Notiz gelb getönt `bg-amber-50`, Anhänge als Download-Links), darunter Tabs „Antworten" (RichTextEditor + `to` vorbelegt mit requesterEmail + optional „Status danach: Wartet auf Kunde/Gelöst") und „Interne Notiz" (RichTextEditor). Actions: `reply`, `note`, `setStatus`, `setPriority`, `assignUser`, `assignCompany`, `addTime`, `deleteTime` (Zeit-Abschnitt siehe Task 8 — Actions hier schon anlegen).
- **Neu:** manuelles Ticket (Betreff, Priorität, Firma/Kontakt-Selects, Beschreibung als Notiz) + optionaler Block „Erst-Mail an Kunden senden" (Empfänger, RichTextEditor) → nutzt `sendTicketReply`.
- **Anhang-Download:** `+server.ts` analog Dokumente-Download (404 wenn Attachment nicht zum Ticket gehört).
- **Dashboard:** Kachelzeile (Offen gesamt / Neu / SLA überfällig in destructive) + Liste der 5 dringendsten offenen Tickets (`listTickets` overdue/due_soon zuerst) über dem Fristen-Widget.
- [ ] **Step 1: Fehlschlagende Tests** für die neuen Query-Funktionen (`listTickets`-Filter + SLA-Sortierung, `getTicketDetail` inkl. Attachments/Autor, `assignTicketCompany` mit Kontakt-Anlage) in `src/lib/server/tickets/tickets.test.ts`.
- [ ] **Step 2: Rot sehen → implementieren → grün.**
- [ ] **Step 3: Routen + Components bauen** (kein Route-Test; Serverlogik ist getestet). `npm run check` + `svelte-autofixer` über alle neuen `.svelte`-Dateien.
- [ ] **Step 4: Browser-Verifikation** — Dev-Server: manuelles Ticket anlegen, Notiz schreiben, Status wechseln, Zuordnungs-Kasten mit Testfirma, Editor-Formatierungen (Liste, Überschrift, Link) prüfen; Screenshot Liste + Detail.
- [ ] **Step 5: Commit** — `git commit -m "feat: tickets-ui (liste, akte, manuell anlegen, dashboard-widgets)"`

---

### Task 8: Zeiterfassung + Monatsreport

**Files:**
- Create: `src/lib/server/time-entries.ts`, `src/lib/validation/timeEntry.ts`, `src/routes/(app)/berichte/zeiten/+page.server.ts`, `+page.svelte`
- Test: `src/lib/server/time-entries.test.ts`, `src/lib/validation/timeEntry.test.ts`
- Modify: `tickets/[id]/+page.svelte` (Zeiten-Abschnitt), `(app)/+layout.svelte` (Nav „Berichte", Lucide `BarChart3`)

**Interfaces:**
- Produces:

```ts
// validation/timeEntry.ts
export const timeEntrySchema; // minutes: coerce int > 0 „Minuten prüfen"; note optional; billable checkbox 'on'→true; workDate ISO (Default heute setzt die Action)
// server/time-entries.ts
export async function addTimeEntry(db, ticketId: string, userId: string, input: TimeEntryInput): Promise<TimeEntry>;
export async function deleteTimeEntry(db, id: string): Promise<void>;
export async function listTimeEntries(db, ticketId: string): Promise<(TimeEntry & { user: { name: string } | null })[]>;
export async function monthlyTimeReport(db, companyId: string, month: string /* '2026-07' */): Promise<{
	entries: { workDate: string; ticketNumber: number; ticketSubject: string; userName: string | null; note: string | null; minutes: number; billable: boolean }[];
	billableMinutes: number; nonBillableMinutes: number;
}>;
```

- Ticket-Detail: Abschnitt „Zeiten" — Tabelle (Datum, Wer, Notiz, Minuten, abrechenbar, Löschen) + Inline-Form (Minuten, Notiz, Datum default heute, Checkbox abrechenbar default an) + Summenzeile.
- Report-Seite `/berichte/zeiten`: GET-Form (Firma-Select, Monats-Input `type="month"` default aktueller Monat) → Tabelle + zwei Summen (abrechenbar/nicht) als `h:mm` formatiert (`formatMinutes(minutes)`-Helper in `+page.svelte`).
- [ ] **Step 1: Fehlschlagende Tests** — CRUD; Report: filtert nach Firma + Monat, summiert getrennt, sortiert nach Datum; Validation happy/sad.
- [ ] **Step 2: Rot → implementieren → grün** (kompletter `npm test`).
- [ ] **Step 3: UI bauen**, `svelte-autofixer`, Browser-Verifikation (Zeit an Ticket erfassen → taucht im Monatsreport auf).
- [ ] **Step 4: Commit** — `git commit -m "feat: zeiterfassung je ticket mit monatsreport je firma"`

---

### Task 9: Doku + Abschluss

**Files:**
- Create: `docs/entra-id-setup.md`
- Modify: `CLAUDE.md` (Stufe-2-Zeile in der Beschreibung), `README.md` (Env-Tabelle + Verweis Entra-Anleitung), `docs/PROJEKT.md` (Stufe 2 → Status, Entscheidungen verlinken)

- [ ] **Step 1: `docs/entra-id-setup.md` schreiben** — Schritt für Schritt: App-Registrierung im Entra-Portal, Application-Permissions `Mail.ReadWrite` + `Mail.Send` (Admin Consent), Client Secret erzeugen (Ablauf notieren!), Application Access Policy per Exchange-Online-PowerShell auf support@corvion.de begrenzen (`New-ApplicationAccessPolicy -AppId … -PolicyScopeGroupId …` inkl. Mail-enabled Security Group anlegen, `Test-ApplicationAccessPolicy` zum Prüfen), Werte in `.env`/`.env.production` eintragen, `TICKET_SYNC=on` erst nach erfolgreichem Test.
- [ ] **Step 2: Gesamtverifikation** — `npm test`, `npm run check`, `npm run build`; Docker-Prod-Build lokal einmal durchziehen (wie bei Stufe 1, `TICKET_SYNC=off`).
- [ ] **Step 3: Commit + Merge** — Branch `stufe-2-tickets` nach `main` mergen, push.

## Bewusst NICHT in Stufe 2

Tabellen/Farben im Editor, Inline-Bilder (CID), SLA-Lösungszeit, Benachrichtigungen (Mail/Teams), Alt-Mail-Import, Kundenportal-Sicht auf Tickets (Stufe 3), Rechnungsentwürfe aus Zeiten (Stufe 4), Löschkonzept/DSGVO-Aufbewahrung (bei Bedarf nachrüsten).
