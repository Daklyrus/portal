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
let ticketId: string;

beforeEach(async () => {
	await db.delete(schema.billingRuns);
	await db.delete(schema.tickets);
	await db.delete(schema.companies);
	const [company] = await db.insert(schema.companies).values({ name: 'Abrechnung GmbH' }).returning();
	companyId = company.id;
	const [ticket] = await db.insert(schema.tickets).values({ subject: 'Zeit', companyId }).returning();
	ticketId = ticket.id;
});

afterAll(async () => {
	await client.end();
});

describe('schema abrechnung', () => {
	it('erlaubt je firma und monat nur einen lauf', async () => {
		const row = {
			companyId,
			month: '2026-06',
			lexofficeInvoiceId: 'lex-inv-1',
			totalNetCents: 49900
		};
		await db.insert(schema.billingRuns).values(row);
		await expect(
			db.insert(schema.billingRuns).values({ ...row, lexofficeInvoiceId: 'lex-inv-2' })
		).rejects.toThrowError();
	});

	it('gibt zeiteinträge beim löschen des laufs frei (SET NULL)', async () => {
		const [run] = await db
			.insert(schema.billingRuns)
			.values({ companyId, month: '2026-06', lexofficeInvoiceId: 'lex-1', totalNetCents: 100 })
			.returning();
		const [entry] = await db
			.insert(schema.timeEntries)
			.values({ ticketId, minutes: 30, workDate: '2026-06-10', billingRunId: run.id })
			.returning();

		await db.delete(schema.billingRuns).where(eq(schema.billingRuns.id, run.id));

		const [after] = await db
			.select()
			.from(schema.timeEntries)
			.where(eq(schema.timeEntries.id, entry.id));
		expect(after.billingRunId).toBeNull();
	});

	it('firmen haben einen optionalen stundensatz', async () => {
		await db
			.update(schema.companies)
			.set({ hourlyRateCents: 10500 })
			.where(eq(schema.companies.id, companyId));
		const [company] = await db
			.select()
			.from(schema.companies)
			.where(eq(schema.companies.id, companyId));
		expect(company.hourlyRateCents).toBe(10500);
	});
});
