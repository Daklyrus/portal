import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { LexofficeClient } from '../lexoffice/client';
import { buildBillingPreview } from './preview';
import { BillingError, createBillingRun, discardBillingRun, listBillingRuns } from './run';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL ist nicht gesetzt');

const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema });

const MONTH = '2026-06';

let companyId: string;

function makeLex(): LexofficeClient {
	return {
		listInvoices: vi.fn(),
		getInvoicePdf: vi.fn(),
		createInvoiceDraft: vi.fn().mockResolvedValue({ id: 'entwurf-99' })
	};
}

beforeEach(async () => {
	await db.delete(schema.billingRuns);
	await db.delete(schema.tickets);
	await db.delete(schema.companies);
	await db.delete(schema.appSettings);
	const [company] = await db
		.insert(schema.companies)
		.values({ name: 'Lauf GmbH', lexofficeContactId: 'lex-1' })
		.returning();
	companyId = company.id;
	const [ticket] = await db
		.insert(schema.tickets)
		.values({ subject: 'Arbeit', companyId })
		.returning();
	await db
		.insert(schema.timeEntries)
		.values({ ticketId: ticket.id, minutes: 90, workDate: '2026-06-05', billable: true });
});

afterAll(async () => {
	await client.end();
});

describe('createBillingRun', () => {
	it('erzeugt den entwurf, speichert den lauf und sperrt die zeiten', async () => {
		const lex = makeLex();
		const run = await createBillingRun(db, lex, companyId, MONTH, null);

		expect(run.lexofficeInvoiceId).toBe('entwurf-99');
		expect(lex.createInvoiceDraft).toHaveBeenCalledOnce();

		const entries = await db.select().from(schema.timeEntries);
		expect(entries[0].billingRunId).toBe(run.id);

		// Firma hat keine offenen Posten mehr → verschwindet aus der Vorschau (Historie zeigt den Lauf)
		const previews = await buildBillingPreview(db, MONTH);
		expect(previews.find((p) => p.company.id === companyId)).toBeUndefined();
	});

	it('verweigert doppel-läufe und firmen ohne lexoffice-zuordnung', async () => {
		const lex = makeLex();
		await createBillingRun(db, lex, companyId, MONTH, null);
		await expect(createBillingRun(db, lex, companyId, MONTH, null)).rejects.toThrow(BillingError);

		const [ohne] = await db.insert(schema.companies).values({ name: 'Ohne Lex' }).returning();
		const [ticket] = await db
			.insert(schema.tickets)
			.values({ subject: 'x', companyId: ohne.id })
			.returning();
		await db
			.insert(schema.timeEntries)
			.values({ ticketId: ticket.id, minutes: 30, workDate: '2026-06-06', billable: true });

		const lex2 = makeLex();
		await expect(createBillingRun(db, lex2, ohne.id, MONTH, null)).rejects.toThrow(BillingError);
		expect(lex2.createInvoiceDraft).not.toHaveBeenCalled();
	});

	it('verweigert läufe ohne posten', async () => {
		const [leer] = await db
			.insert(schema.companies)
			.values({ name: 'Leer GmbH', lexofficeContactId: 'lex-leer' })
			.returning();
		await expect(createBillingRun(db, makeLex(), leer.id, MONTH, null)).rejects.toThrow(
			BillingError
		);
	});
});

describe('discardBillingRun / listBillingRuns', () => {
	it('verwerfen gibt zeiten frei; liste liefert firmennamen', async () => {
		const run = await createBillingRun(db, makeLex(), companyId, MONTH, null);

		const runs = await listBillingRuns(db, MONTH);
		expect(runs).toHaveLength(1);
		expect(runs[0].companyName).toBe('Lauf GmbH');

		await discardBillingRun(db, run.id);

		const [entry] = await db.select().from(schema.timeEntries);
		expect(entry.billingRunId).toBeNull();
		expect(await listBillingRuns(db, MONTH)).toHaveLength(0);

		const previews = await buildBillingPreview(db, MONTH);
		expect(previews.find((p) => p.company.id === companyId)?.totalMinutes).toBe(90);
	});
});
