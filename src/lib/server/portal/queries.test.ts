import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../db/schema';
import {
	getPortalInvoice,
	getSharedDocument,
	listPortalInvoices,
	listSharedContracts,
	listSharedDocuments
} from './queries';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL ist nicht gesetzt');

const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema });

let ownId: string;
let otherId: string;

beforeEach(async () => {
	await db.delete(schema.companies);
	const [own] = await db.insert(schema.companies).values({ name: 'Eigene GmbH' }).returning();
	const [other] = await db.insert(schema.companies).values({ name: 'Fremde AG' }).returning();
	ownId = own.id;
	otherId = other.id;
});

afterAll(async () => {
	await client.end();
});

describe('listPortalInvoices / getPortalInvoice', () => {
	it('liefert nur eigene, nicht stornierte rechnungen — neueste zuerst', async () => {
		await db.insert(schema.invoices).values([
			{ companyId: ownId, lexofficeId: 'a', voucherNumber: 'RE-1', voucherDate: '2026-06-01', totalCents: 100, status: 'paid' },
			{ companyId: ownId, lexofficeId: 'b', voucherNumber: 'RE-2', voucherDate: '2026-07-01', totalCents: 200, status: 'open' },
			{ companyId: ownId, lexofficeId: 'c', voucherNumber: 'RE-3', voucherDate: '2026-07-02', totalCents: 300, status: 'voided' },
			{ companyId: otherId, lexofficeId: 'd', voucherNumber: 'RE-4', voucherDate: '2026-07-03', totalCents: 400, status: 'open' }
		]);

		const list = await listPortalInvoices(db, ownId);
		expect(list.map((i) => i.voucherNumber)).toEqual(['RE-2', 'RE-1']);

		const own = await getPortalInvoice(db, ownId, list[0].id);
		expect(own?.voucherNumber).toBe('RE-2');

		// fremde rechnung über eigene companyId → undefined
		const [foreign] = await db
			.select()
			.from(schema.invoices)
			.where((await import('drizzle-orm')).eq(schema.invoices.lexofficeId, 'd'));
		expect(await getPortalInvoice(db, ownId, foreign.id)).toBeUndefined();
	});
});

describe('listSharedContracts / listSharedDocuments', () => {
	it('liefert nur freigegebene einträge der eigenen firma', async () => {
		await db.insert(schema.contracts).values([
			{ companyId: ownId, title: 'Frei', startDate: '2026-01-01', initialTermMonths: 12, sharedWithCustomer: true },
			{ companyId: ownId, title: 'Intern', startDate: '2026-01-01', initialTermMonths: 12 },
			{ companyId: otherId, title: 'Fremd frei', startDate: '2026-01-01', initialTermMonths: 12, sharedWithCustomer: true }
		]);
		await db.insert(schema.documents).values([
			{ companyId: ownId, fileName: 'frei.pdf', storagePath: 'x/a.pdf', mimeType: 'application/pdf', sizeBytes: 1, sharedWithCustomer: true },
			{ companyId: ownId, fileName: 'intern.pdf', storagePath: 'x/b.pdf', mimeType: 'application/pdf', sizeBytes: 1 }
		]);

		expect((await listSharedContracts(db, ownId)).map((c) => c.title)).toEqual(['Frei']);
		expect((await listSharedDocuments(db, ownId)).map((d) => d.fileName)).toEqual(['frei.pdf']);

		const shared = (await listSharedDocuments(db, ownId))[0];
		expect((await getSharedDocument(db, ownId, shared.id))?.fileName).toBe('frei.pdf');

		// nicht freigegebenes dokument ist auch per id unsichtbar
		const [internal] = (
			await db.select().from(schema.documents)
		).filter((d) => d.fileName === 'intern.pdf');
		expect(await getSharedDocument(db, ownId, internal.id)).toBeUndefined();
	});
});
