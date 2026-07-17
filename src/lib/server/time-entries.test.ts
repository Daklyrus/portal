import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './db/schema';
import { createCompany } from './companies';
import { createTicket } from './tickets/tickets';
import {
	addTimeEntry,
	deleteTimeEntry,
	listTimeEntries,
	monthlyTimeReport
} from './time-entries';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL ist nicht gesetzt');

const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema });

let companyId: string;
let ticketId: string;

beforeEach(async () => {
	await db.delete(schema.tickets);
	await db.delete(schema.companies);
	await db.delete(schema.user);
	await db
		.insert(schema.user)
		.values({ id: 'tech-1', name: 'Toni', email: 't@corvion.de', emailVerified: true });
	const company = await createCompany(db, {
		name: 'Zeit AG',
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
	const ticket = await createTicket(db, { subject: 'Zeittest', companyId });
	ticketId = ticket.id;
});

afterAll(async () => {
	await client.end();
});

describe('time-entries', () => {
	it('legt einträge an, listet mit nutzer und löscht', async () => {
		const entry = await addTimeEntry(db, ticketId, 'tech-1', {
			minutes: 45,
			note: 'Fernwartung',
			billable: true,
			workDate: '2026-07-16'
		});

		const list = await listTimeEntries(db, ticketId);
		expect(list).toHaveLength(1);
		expect(list[0].user?.name).toBe('Toni');

		await deleteTimeEntry(db, entry.id);
		expect(await listTimeEntries(db, ticketId)).toHaveLength(0);
	});

	it('monatsreport filtert nach firma und monat, summiert getrennt', async () => {
		await addTimeEntry(db, ticketId, 'tech-1', {
			minutes: 60,
			note: 'Abrechenbar Juli',
			billable: true,
			workDate: '2026-07-01'
		});
		await addTimeEntry(db, ticketId, 'tech-1', {
			minutes: 30,
			note: 'Kulanz Juli',
			billable: false,
			workDate: '2026-07-20'
		});
		await addTimeEntry(db, ticketId, 'tech-1', {
			minutes: 99,
			note: 'August',
			billable: true,
			workDate: '2026-08-01'
		});

		// Anderes Unternehmen darf nicht auftauchen
		const other = await createCompany(db, {
			name: 'Fremd GmbH',
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
		const otherTicket = await createTicket(db, { subject: 'Fremd', companyId: other.id });
		await addTimeEntry(db, otherTicket.id, 'tech-1', {
			minutes: 500,
			note: null,
			billable: true,
			workDate: '2026-07-10'
		});

		const report = await monthlyTimeReport(db, companyId, '2026-07');
		expect(report.entries.map((e) => e.note)).toEqual(['Abrechenbar Juli', 'Kulanz Juli']);
		expect(report.entries[0].ticketNumber).toBeGreaterThanOrEqual(1001);
		expect(report.billableMinutes).toBe(60);
		expect(report.nonBillableMinutes).toBe(30);
	});
});
