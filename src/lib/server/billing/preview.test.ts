import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { setSetting, SETTING_HOURLY_RATE } from '../settings';
import { buildBillingPreview, DEFAULT_HOURLY_RATE_CENTS } from './preview';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL ist nicht gesetzt');

const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema });

const MONTH = '2026-06';

let companyId: string;
let ticketId: string;

async function makeCompany(name: string, overrides: Partial<typeof schema.companies.$inferInsert> = {}) {
	const [company] = await db
		.insert(schema.companies)
		.values({ name, lexofficeContactId: `lex-${name}`, ...overrides })
		.returning();
	return company;
}

async function makeTime(tid: string, minutes: number, overrides: Partial<typeof schema.timeEntries.$inferInsert> = {}) {
	const [entry] = await db
		.insert(schema.timeEntries)
		.values({ ticketId: tid, minutes, workDate: '2026-06-10', billable: true, ...overrides })
		.returning();
	return entry;
}

beforeEach(async () => {
	await db.delete(schema.billingRuns);
	await db.delete(schema.tickets);
	await db.delete(schema.companies);
	await db.delete(schema.appSettings);
	const company = await makeCompany('Alpha GmbH');
	companyId = company.id;
	const [ticket] = await db
		.insert(schema.tickets)
		.values({ subject: 'Serverwartung', companyId })
		.returning();
	ticketId = ticket.id;
});

afterAll(async () => {
	await client.end();
});

describe('buildBillingPreview', () => {
	it('summiert pauschalen und zeiten exakt und rechnet mit dem standard-satz', async () => {
		await setSetting(db, SETTING_HOURLY_RATE, '9500');
		await db.insert(schema.contracts).values({
			companyId,
			title: 'Managed Basic',
			status: 'active',
			startDate: '2026-01-01',
			initialTermMonths: 12,
			monthlyFeeCents: 49900
		});
		await makeTime(ticketId, 120);
		await makeTime(ticketId, 127);

		const [preview] = await buildBillingPreview(db, MONTH);

		expect(preview.company.id).toBe(companyId);
		expect(preview.totalMinutes).toBe(247);
		expect(preview.hours).toBe(4.12); // 247/60 = 4.1166… → 4.12
		expect(preview.hourlyRateCents).toBe(9500);
		expect(preview.laborNetCents).toBe(39140); // 4.12 * 9500
		expect(preview.flatFeesNetCents).toBe(49900);
		expect(preview.totalNetCents).toBe(89040);
		expect(preview.missingLexofficeId).toBe(false);
		expect(preview.alreadyBilled).toBe(false);
	});

	it('firmen-satz überschreibt den standard; ohne setting greift der default', async () => {
		await db
			.update(schema.companies)
			.set({ hourlyRateCents: 12000 })
			.where(eq(schema.companies.id, companyId));
		await makeTime(ticketId, 60);

		const [preview] = await buildBillingPreview(db, MONTH);
		expect(preview.hourlyRateCents).toBe(12000);

		const beta = await makeCompany('Beta AG');
		const [betaTicket] = await db
			.insert(schema.tickets)
			.values({ subject: 'x', companyId: beta.id })
			.returning();
		await makeTime(betaTicket.id, 60);

		const previews = await buildBillingPreview(db, MONTH);
		const betaPreview = previews.find((p) => p.company.id === beta.id);
		expect(betaPreview?.hourlyRateCents).toBe(DEFAULT_HOURLY_RATE_CENTS);
	});

	it('zählt nur offene abrechenbare zeiten des monats', async () => {
		await makeTime(ticketId, 60); // zählt
		await makeTime(ticketId, 60, { billable: false }); // nicht abrechenbar
		await makeTime(ticketId, 60, { workDate: '2026-05-31' }); // falscher monat
		const [run] = await db
			.insert(schema.billingRuns)
			.values({ companyId, month: '2026-05', lexofficeInvoiceId: 'x', totalNetCents: 1 })
			.returning();
		await makeTime(ticketId, 60, { billingRunId: run.id }); // schon abgerechnet

		const [preview] = await buildBillingPreview(db, MONTH);
		expect(preview.totalMinutes).toBe(60);
	});

	it('zählt nur aktive pauschal-verträge und merkt startmonat an', async () => {
		await db.insert(schema.contracts).values([
			{ companyId, title: 'Startet im Monat', status: 'active', startDate: '2026-06-15', initialTermMonths: 12, monthlyFeeCents: 10000 },
			{ companyId, title: 'Entwurf', status: 'draft', startDate: '2026-01-01', initialTermMonths: 12, monthlyFeeCents: 99900 },
			{ companyId, title: 'Ohne Pauschale', status: 'active', startDate: '2026-01-01', initialTermMonths: 12, monthlyFeeCents: 0 },
			{ companyId, title: 'Startet später', status: 'active', startDate: '2026-07-01', initialTermMonths: 12, monthlyFeeCents: 5000 }
		]);

		const [preview] = await buildBillingPreview(db, MONTH);
		expect(preview.contracts).toHaveLength(1);
		expect(preview.contracts[0].contract.title).toBe('Startet im Monat');
		expect(preview.contracts[0].note).toContain('15.06.2026');
		expect(preview.flatFeesNetCents).toBe(10000);
	});

	it('markiert fehlende lexoffice-zuordnung und bestehende läufe; leere firmen fehlen', async () => {
		await db
			.update(schema.companies)
			.set({ lexofficeContactId: null })
			.where(eq(schema.companies.id, companyId));
		await makeTime(ticketId, 30);
		await db
			.insert(schema.billingRuns)
			.values({ companyId, month: MONTH, lexofficeInvoiceId: 'x', totalNetCents: 1 });
		await makeCompany('Leer GmbH'); // weder vertrag noch zeiten

		const previews = await buildBillingPreview(db, MONTH);
		expect(previews).toHaveLength(1);
		expect(previews[0].missingLexofficeId).toBe(true);
		expect(previews[0].alreadyBilled).toBe(true);
	});
});
