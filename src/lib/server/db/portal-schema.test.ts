import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import * as schema from './schema';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL ist nicht gesetzt');

const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema });

let companyId: string;
let contactId: string;

beforeEach(async () => {
	await db.delete(schema.invoices);
	await db.delete(schema.companies);
	await db.delete(schema.user);
	const [company] = await db.insert(schema.companies).values({ name: 'Portal GmbH' }).returning();
	companyId = company.id;
	const [contact] = await db
		.insert(schema.contacts)
		.values({ companyId, firstName: 'Petra', lastName: 'Portal', email: 'p@portal.de' })
		.returning();
	contactId = contact.id;
	await db
		.insert(schema.user)
		.values({ id: 'portal-user-1', name: 'Petra Portal', email: 'p@portal.de', emailVerified: true });
});

afterAll(async () => {
	await client.end();
});

describe('schema portal', () => {
	it('legt portal-zugang an; zweiter zugang für denselben kontakt schlägt fehl', async () => {
		const [access] = await db
			.insert(schema.portalAccess)
			.values({ userId: 'portal-user-1', contactId, companyId })
			.returning();
		expect(access.id).toBeTruthy();

		await db
			.insert(schema.user)
			.values({ id: 'portal-user-2', name: 'Zwei', email: 'zwei@portal.de', emailVerified: true });
		await expect(
			db.insert(schema.portalAccess).values({ userId: 'portal-user-2', contactId, companyId })
		).rejects.toThrowError();
	});

	it('kaskadiert den zugang beim löschen des kontakts', async () => {
		await db.insert(schema.portalAccess).values({ userId: 'portal-user-1', contactId, companyId });
		await db.delete(schema.contacts).where(eq(schema.contacts.id, contactId));
		expect(await db.select().from(schema.portalAccess)).toHaveLength(0);
	});

	it('lehnt doppelte lexoffice-ids bei rechnungen ab', async () => {
		const row = {
			companyId,
			lexofficeId: 'lex-1',
			voucherNumber: 'RE-1001',
			voucherDate: '2026-07-01',
			totalCents: 49900,
			status: 'open' as const
		};
		await db.insert(schema.invoices).values(row);
		await expect(db.insert(schema.invoices).values(row)).rejects.toThrowError();
	});

	it('neue verträge sind standardmäßig nicht fürs portal freigegeben', async () => {
		const [contract] = await db
			.insert(schema.contracts)
			.values({ companyId, title: 'Basic', startDate: '2026-01-01', initialTermMonths: 12 })
			.returning();
		expect(contract.sharedWithCustomer).toBe(false);
	});
});
