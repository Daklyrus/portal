import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './db/schema';
import { createCompany, updateCompany, deleteCompany, searchCompanies, getCompany } from './companies';

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

const input = {
	name: 'Muster GmbH',
	customerNumber: 'K-1001',
	street: null,
	zip: null,
	city: 'Gütersloh',
	email: null,
	phone: null,
	website: null,
	notes: null,
	lexofficeContactId: null
};

describe('companies serverlogik', () => {
	it('legt eine firma an und liest sie über getCompany', async () => {
		const created = await createCompany(db, input);
		const found = await getCompany(db, created.id);
		expect(found?.name).toBe('Muster GmbH');
	});

	it('aktualisiert eine firma', async () => {
		const created = await createCompany(db, input);
		await updateCompany(db, created.id, { ...input, city: 'Bielefeld' });
		const found = await getCompany(db, created.id);
		expect(found?.city).toBe('Bielefeld');
	});

	it('findet firmen per suche in name und kundennummer, sortiert nach name', async () => {
		await createCompany(db, input);
		await createCompany(db, { ...input, name: 'Andere AG', customerNumber: 'K-2000' });

		expect((await searchCompanies(db, 'muster')).map((c) => c.name)).toEqual(['Muster GmbH']);
		expect((await searchCompanies(db, 'K-2000')).map((c) => c.name)).toEqual(['Andere AG']);
		expect((await searchCompanies(db, '')).map((c) => c.name)).toEqual(['Andere AG', 'Muster GmbH']);
	});

	it('löscht eine firma', async () => {
		const created = await createCompany(db, input);
		await deleteCompany(db, created.id);
		expect(await getCompany(db, created.id)).toBeUndefined();
	});
});
