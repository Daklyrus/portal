import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import * as schema from './schema';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL ist nicht gesetzt');

const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema });

beforeEach(async () => {
	await db.delete(schema.companies);
});

afterAll(async () => {
	await client.end();
});

describe('schema kundenakte', () => {
	it('legt eine firma an und liest sie zurück', async () => {
		const [created] = await db
			.insert(schema.companies)
			.values({ name: 'Muster GmbH', city: 'Gütersloh', customerNumber: 'K-1001' })
			.returning();

		expect(created.id).toBeTruthy();

		const rows = await db
			.select()
			.from(schema.companies)
			.where(eq(schema.companies.id, created.id));

		expect(rows).toHaveLength(1);
		expect(rows[0].name).toBe('Muster GmbH');
		expect(rows[0].customerNumber).toBe('K-1001');
	});

	it('löscht kontakte, verträge und dokumente mit der firma (cascade)', async () => {
		const [company] = await db
			.insert(schema.companies)
			.values({ name: 'Cascade AG' })
			.returning();

		await db.insert(schema.contacts).values({
			companyId: company.id,
			firstName: 'Max',
			lastName: 'Muster'
		});
		await db.insert(schema.contracts).values({
			companyId: company.id,
			title: 'Managed Services Basic',
			startDate: '2026-01-01',
			initialTermMonths: 12
		});
		await db.insert(schema.documents).values({
			companyId: company.id,
			fileName: 'vertrag.pdf',
			storagePath: 'uploads/x/y.pdf',
			mimeType: 'application/pdf',
			sizeBytes: 1234
		});

		await db.delete(schema.companies).where(eq(schema.companies.id, company.id));

		expect(await db.select().from(schema.contacts)).toHaveLength(0);
		expect(await db.select().from(schema.contracts)).toHaveLength(0);
		expect(await db.select().from(schema.documents)).toHaveLength(0);
	});
});
