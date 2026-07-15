import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { addMonths, format, subMonths } from 'date-fns';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './db/schema';
import { createCompany } from './companies';
import {
	createContract,
	getUpcomingDeadlines,
	listContractsWithDeadlines,
	markContractCancelled,
	updateContract
} from './contracts';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL ist nicht gesetzt');

const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema });

let companyId: string;

const ISO = 'yyyy-MM-dd';

const base = {
	title: 'Managed Services Basic',
	description: null,
	status: 'active' as const,
	initialTermMonths: 12,
	renewalTermMonths: 12,
	noticePeriodMonths: 3,
	monthlyFeeCents: 49900,
	includedServices: null
};

beforeEach(async () => {
	await db.delete(schema.companies);
	const company = await createCompany(db, {
		name: 'Vertrag-Test GmbH',
		customerNumber: null,
		street: null,
		zip: null,
		city: null,
		email: null,
		phone: null,
		website: null,
		notes: null
	});
	companyId = company.id;
});

afterAll(async () => {
	await client.end();
});

describe('contracts serverlogik', () => {
	it('legt vertrag an, listet ihn mit fristen und aktualisiert ihn', async () => {
		// Start vor 2 Monaten → Kündigungsdeadline in ~7 Monaten
		const startDate = format(subMonths(new Date(), 2), ISO);
		const created = await createContract(db, companyId, { ...base, startDate });

		const list = await listContractsWithDeadlines(db, companyId, new Date());
		expect(list).toHaveLength(1);
		expect(list[0].contract.id).toBe(created.id);
		expect(list[0].deadlines.daysUntilCancellationDeadline).toBeGreaterThan(0);

		await updateContract(db, created.id, { ...base, startDate, title: 'Managed Premium' });
		const updated = await listContractsWithDeadlines(db, companyId, new Date());
		expect(updated[0].contract.title).toBe('Managed Premium');
	});

	it('liefert anstehende fristen im zeitfenster, ohne gekündigte und entwürfe', async () => {
		const today = new Date();
		// Deadline in ~1 Monat: Periodenende in 4 Monaten bei 3 Monaten Frist
		const soon = format(subMonths(addMonths(today, 4), 12), ISO);
		// Deadline weit weg: Start heute, 12 Monate Laufzeit
		const far = format(today, ISO);

		await createContract(db, companyId, { ...base, startDate: soon, title: 'Bald fällig' });
		await createContract(db, companyId, { ...base, startDate: far, title: 'Später fällig' });
		await createContract(db, companyId, {
			...base,
			startDate: soon,
			title: 'Entwurf',
			status: 'draft'
		});
		const cancelled = await createContract(db, companyId, {
			...base,
			startDate: soon,
			title: 'Gekündigt'
		});
		await markContractCancelled(db, cancelled.id, format(today, ISO));

		const upcoming = await getUpcomingDeadlines(db, 90, today);
		expect(upcoming.map((u) => u.contract.title)).toEqual(['Bald fällig']);
		expect(upcoming[0].company.name).toBe('Vertrag-Test GmbH');
	});
});
