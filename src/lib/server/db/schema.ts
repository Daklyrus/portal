import {
	pgTable,
	pgEnum,
	text,
	uuid,
	boolean,
	integer,
	date,
	timestamp
} from 'drizzle-orm/pg-core';
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

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type Contract = typeof contracts.$inferSelect;
export type NewContract = typeof contracts.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;

export * from './auth.schema';
