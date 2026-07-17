import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../db/schema';
import { createCompany } from '../companies';
import { createDocument, deleteDocument, getDocument, listDocuments } from './documents';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL ist nicht gesetzt');

const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema });

let companyId: string;

beforeEach(async () => {
	await db.delete(schema.companies);
	const company = await createCompany(db, {
		name: 'Doku-Test GmbH',
		customerNumber: null,
		street: null,
		zip: null,
		city: null,
		email: null,
		phone: null,
		website: null,
		notes: null,
		lexofficeContactId: null
	});
	companyId = company.id;
});

afterAll(async () => {
	await client.end();
});

describe('documents db', () => {
	it('legt dokument an, listet neueste zuerst, liest und löscht', async () => {
		const first = await createDocument(db, {
			companyId,
			fileName: 'alt.pdf',
			storagePath: `${companyId}/a.pdf`,
			mimeType: 'application/pdf',
			sizeBytes: 10,
			sharedWithCustomer: false,
			uploadedById: null
		});
		const second = await createDocument(db, {
			companyId,
			fileName: 'neu.pdf',
			storagePath: `${companyId}/b.pdf`,
			mimeType: 'application/pdf',
			sizeBytes: 20,
			sharedWithCustomer: true,
			uploadedById: null
		});

		const list = await listDocuments(db, companyId);
		expect(list.map((d) => d.fileName)).toEqual(['neu.pdf', 'alt.pdf']);

		expect((await getDocument(db, second.id))?.sharedWithCustomer).toBe(true);

		await deleteDocument(db, first.id);
		expect(await listDocuments(db, companyId)).toHaveLength(1);
	});
});
