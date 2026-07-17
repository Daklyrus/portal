import {
	pgTable,
	pgEnum,
	pgSequence,
	text,
	uuid,
	boolean,
	integer,
	date,
	timestamp,
	unique
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from './auth.schema';

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
	// Stufe 3: Verknüpfung für den Rechnungs-Sync
	lexofficeContactId: text('lexoffice_contact_id'),
	// Stufe 4: Stundensatz netto in Cent; null = globaler Standard
	hourlyRateCents: integer('hourly_rate_cents'),
	...timestamps
});

export const contacts = pgTable('contacts', {
	id: uuid('id').primaryKey().defaultRandom(),
	companyId: uuid('company_id')
		.notNull()
		.references(() => companies.id, { onDelete: 'cascade' }),
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
	companyId: uuid('company_id')
		.notNull()
		.references(() => companies.id, { onDelete: 'cascade' }),
	title: text('title').notNull(),
	description: text('description'),
	status: contractStatus('status').default('draft').notNull(),
	startDate: date('start_date', { mode: 'string' }).notNull(),
	initialTermMonths: integer('initial_term_months').notNull(),
	// 0 = Vertrag läuft aus statt sich zu verlängern
	renewalTermMonths: integer('renewal_term_months').default(12).notNull(),
	noticePeriodMonths: integer('notice_period_months').default(3).notNull(),
	monthlyFeeCents: integer('monthly_fee_cents').default(0).notNull(),
	includedServices: text('included_services'),
	cancelledAt: date('cancelled_at', { mode: 'string' }),
	// Stufe 3: Vertragsdaten im Kundenportal sichtbar
	sharedWithCustomer: boolean('shared_with_customer').default(false).notNull(),
	...timestamps
});

export const documents = pgTable('documents', {
	id: uuid('id').primaryKey().defaultRandom(),
	companyId: uuid('company_id')
		.notNull()
		.references(() => companies.id, { onDelete: 'cascade' }),
	fileName: text('file_name').notNull(),
	storagePath: text('storage_path').notNull(),
	mimeType: text('mime_type').notNull(),
	sizeBytes: integer('size_bytes').notNull(),
	// Stufe 3: steuert Sichtbarkeit im Kundenportal
	sharedWithCustomer: boolean('shared_with_customer').default(false).notNull(),
	uploadedById: text('uploaded_by_id').references(() => user.id, { onDelete: 'set null' }),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export const ticketStatus = pgEnum('ticket_status', [
	'new',
	'in_progress',
	'waiting_customer',
	'resolved',
	'closed'
]);
export const ticketPriority = pgEnum('ticket_priority', ['normal', 'high', 'critical']);
export const messageKind = pgEnum('message_kind', ['inbound', 'outbound', 'note']);

export const ticketNumberSeq = pgSequence('ticket_number_seq', { startWith: 1001 });

export const tickets = pgTable('tickets', {
	id: uuid('id').primaryKey().defaultRandom(),
	number: integer('number')
		.notNull()
		.unique()
		.default(sql`nextval('ticket_number_seq')`),
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
	ticketId: uuid('ticket_id')
		.notNull()
		.references(() => tickets.id, { onDelete: 'cascade' }),
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
	messageId: uuid('message_id')
		.notNull()
		.references(() => ticketMessages.id, { onDelete: 'cascade' }),
	fileName: text('file_name').notNull(),
	storagePath: text('storage_path').notNull(),
	mimeType: text('mime_type').notNull(),
	sizeBytes: integer('size_bytes').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export const timeEntries = pgTable('time_entries', {
	id: uuid('id').primaryKey().defaultRandom(),
	ticketId: uuid('ticket_id')
		.notNull()
		.references(() => tickets.id, { onDelete: 'cascade' }),
	userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
	minutes: integer('minutes').notNull(),
	note: text('note'),
	billable: boolean('billable').default(true).notNull(),
	workDate: date('work_date', { mode: 'string' }).notNull(),
	// Stufe 4: gesetzt = im Abrechnungslauf enthalten; Lauf löschen gibt frei (SET NULL)
	billingRunId: uuid('billing_run_id').references(() => billingRuns.id, { onDelete: 'set null' }),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

// Stufe 4: ein Abrechnungslauf = ein lexoffice-Rechnungsentwurf je Firma und Monat
export const billingRuns = pgTable(
	'billing_runs',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		companyId: uuid('company_id')
			.notNull()
			.references(() => companies.id, { onDelete: 'cascade' }),
		month: text('month').notNull(), // 'yyyy-MM'
		lexofficeInvoiceId: text('lexoffice_invoice_id').notNull(),
		totalNetCents: integer('total_net_cents').notNull(),
		createdById: text('created_by_id').references(() => user.id, { onDelete: 'set null' }),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
	},
	(t) => [unique().on(t.companyId, t.month)]
);

// Globale Schlüssel-Wert-Einstellungen (z. B. Standard-Stundensatz)
export const appSettings = pgTable('app_settings', {
	key: text('key').primaryKey(),
	value: text('value').notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

// Kundenportal: Login-Bindung Nutzer ↔ Ansprechpartner ↔ Firma
export const portalAccess = pgTable('portal_access', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: text('user_id')
		.notNull()
		.unique()
		.references(() => user.id, { onDelete: 'cascade' }),
	contactId: uuid('contact_id')
		.notNull()
		.unique()
		.references(() => contacts.id, { onDelete: 'cascade' }),
	companyId: uuid('company_id')
		.notNull()
		.references(() => companies.id, { onDelete: 'cascade' }),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export const invoiceStatus = pgEnum('invoice_status', ['open', 'paid', 'overdue', 'voided']);

// Rechnungs-Spiegel aus lexoffice (Sync, keine führenden Daten)
export const invoices = pgTable('invoices', {
	id: uuid('id').primaryKey().defaultRandom(),
	companyId: uuid('company_id')
		.notNull()
		.references(() => companies.id, { onDelete: 'cascade' }),
	lexofficeId: text('lexoffice_id').notNull().unique(),
	voucherNumber: text('voucher_number').notNull(),
	voucherDate: date('voucher_date', { mode: 'string' }).notNull(),
	dueDate: date('due_date', { mode: 'string' }),
	totalCents: integer('total_cents').notNull(),
	currency: text('currency').default('EUR').notNull(),
	status: invoiceStatus('status').notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

// Key-Value-Ablage für Graph-Delta-Links des Ticket-Syncs
export const syncState = pgTable('sync_state', {
	key: text('key').primaryKey(),
	value: text('value').notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type Contract = typeof contracts.$inferSelect;
export type NewContract = typeof contracts.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type Ticket = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;
export type TicketMessage = typeof ticketMessages.$inferSelect;
export type NewTicketMessage = typeof ticketMessages.$inferInsert;
export type TicketAttachment = typeof ticketAttachments.$inferSelect;
export type TimeEntry = typeof timeEntries.$inferSelect;
export type NewTimeEntry = typeof timeEntries.$inferInsert;
export type TicketStatus = Ticket['status'];
export type TicketPriority = Ticket['priority'];
export type BillingRun = typeof billingRuns.$inferSelect;
export type AppSetting = typeof appSettings.$inferSelect;
export type PortalAccess = typeof portalAccess.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type InvoiceStatus = Invoice['status'];

export * from './auth.schema';
