import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { runInvoiceSyncOnce } from './sync';
import type { LexofficeClient, LexofficeInvoice } from './client';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL ist nicht gesetzt');

const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema });

let companyId: string;

function makeLex(invoices: LexofficeInvoice[]): LexofficeClient {
	return {
		listInvoices: vi.fn().mockResolvedValue(invoices),
		getInvoicePdf: vi.fn(),
		createInvoiceDraft: vi.fn()
	};
}

const invoice = (id: string, overrides: Partial<LexofficeInvoice> = {}): LexofficeInvoice => ({
	lexofficeId: id,
	voucherNumber: `RE-${id}`,
	voucherDate: '2026-07-01',
	dueDate: '2026-07-15',
	totalCents: 49900,
	status: 'open',
	contactId: 'lex-kontakt-1',
	...overrides
});

beforeEach(async () => {
	await db.delete(schema.invoices);
	await db.delete(schema.companies);
	const [company] = await db
		.insert(schema.companies)
		.values({ name: 'Sync GmbH', lexofficeContactId: 'lex-kontakt-1' })
		.returning();
	companyId = company.id;
});

afterAll(async () => {
	await client.end();
});

describe('runInvoiceSyncOnce', () => {
	it('legt rechnungen zugeordneter firmen an und ignoriert fremde kontakte', async () => {
		const lex = makeLex([invoice('a'), invoice('b', { contactId: 'unbekannt' })]);

		const result = await runInvoiceSyncOnce(db, lex);

		expect(result.synced).toBe(1);
		const rows = await db.select().from(schema.invoices);
		expect(rows).toHaveLength(1);
		expect(rows[0].companyId).toBe(companyId);
		expect(rows[0].voucherNumber).toBe('RE-a');
	});

	it('aktualisiert bestehende rechnungen statt zu duplizieren', async () => {
		await runInvoiceSyncOnce(db, makeLex([invoice('a')]));
		await runInvoiceSyncOnce(db, makeLex([invoice('a', { status: 'paid', totalCents: 50000 })]));

		const rows = await db.select().from(schema.invoices).where(eq(schema.invoices.lexofficeId, 'a'));
		expect(rows).toHaveLength(1);
		expect(rows[0].status).toBe('paid');
		expect(rows[0].totalCents).toBe(50000);
	});

	it('tut ohne zugeordnete firmen gar nichts', async () => {
		await db.update(schema.companies).set({ lexofficeContactId: null });
		const lex = makeLex([invoice('a')]);

		const result = await runInvoiceSyncOnce(db, lex);

		expect(result.synced).toBe(0);
		expect(lex.listInvoices).not.toHaveBeenCalled();
	});
});
