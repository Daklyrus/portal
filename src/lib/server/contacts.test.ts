import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './db/schema';
import { createCompany } from './companies';
import { createContact, updateContact, deleteContact, listContacts, setPrimaryContact } from './contacts';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL ist nicht gesetzt');

const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema });

let companyId: string;

const input = {
	firstName: 'Max',
	lastName: 'Muster',
	position: null,
	email: null,
	phone: null,
	mobile: null,
	notes: null
};

beforeEach(async () => {
	await db.delete(schema.companies);
	const company = await createCompany(db, {
		name: 'Kontakt-Test GmbH',
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

describe('contacts serverlogik', () => {
	it('legt kontakte an und listet sie nach nachname sortiert', async () => {
		await createContact(db, companyId, { ...input, lastName: 'Zimmer' });
		await createContact(db, companyId, { ...input, lastName: 'Albers' });
		const list = await listContacts(db, companyId);
		expect(list.map((c) => c.lastName)).toEqual(['Albers', 'Zimmer']);
	});

	it('aktualisiert und löscht einen kontakt', async () => {
		const created = await createContact(db, companyId, input);
		await updateContact(db, created.id, { ...input, position: 'Geschäftsführung' });
		expect((await listContacts(db, companyId))[0].position).toBe('Geschäftsführung');
		await deleteContact(db, created.id);
		expect(await listContacts(db, companyId)).toHaveLength(0);
	});

	it('markiert genau einen kontakt je firma als hauptkontakt', async () => {
		const a = await createContact(db, companyId, input);
		const b = await createContact(db, companyId, { ...input, lastName: 'Beispiel' });

		await setPrimaryContact(db, companyId, a.id);
		await setPrimaryContact(db, companyId, b.id);

		const list = await listContacts(db, companyId);
		const primaries = list.filter((c) => c.isPrimary);
		expect(primaries).toHaveLength(1);
		expect(primaries[0].id).toBe(b.id);
	});
});
