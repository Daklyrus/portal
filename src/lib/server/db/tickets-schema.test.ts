import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import * as schema from './schema';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL ist nicht gesetzt');

const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema });

beforeEach(async () => {
	await db.delete(schema.tickets);
	await db.delete(schema.companies);
});

afterAll(async () => {
	await client.end();
});

describe('schema tickets', () => {
	it('vergibt fortlaufende ticketnummern ab 1001', async () => {
		const [first] = await db
			.insert(schema.tickets)
			.values({ subject: 'Drucker kaputt' })
			.returning();
		const [second] = await db
			.insert(schema.tickets)
			.values({ subject: 'Server langsam' })
			.returning();

		expect(first.number).toBeGreaterThanOrEqual(1001);
		expect(second.number).toBe(first.number + 1);
		expect(first.status).toBe('new');
		expect(first.priority).toBe('normal');
	});

	it('kaskadiert nachrichten, anhänge und zeiten beim ticket-löschen', async () => {
		const [ticket] = await db.insert(schema.tickets).values({ subject: 'Test' }).returning();
		const [message] = await db
			.insert(schema.ticketMessages)
			.values({ ticketId: ticket.id, kind: 'inbound', bodyHtml: '<p>Hallo</p>' })
			.returning();
		await db.insert(schema.ticketAttachments).values({
			messageId: message.id,
			fileName: 'log.txt',
			storagePath: 'tickets/x.txt',
			mimeType: 'text/plain',
			sizeBytes: 10
		});
		await db
			.insert(schema.timeEntries)
			.values({ ticketId: ticket.id, minutes: 30, workDate: '2026-07-16' });

		await db.delete(schema.tickets).where(eq(schema.tickets.id, ticket.id));

		expect(await db.select().from(schema.ticketMessages)).toHaveLength(0);
		expect(await db.select().from(schema.ticketAttachments)).toHaveLength(0);
		expect(await db.select().from(schema.timeEntries)).toHaveLength(0);
	});

	it('behält das ticket, wenn die firma gelöscht wird (companyId wird null)', async () => {
		const [company] = await db
			.insert(schema.companies)
			.values({ name: 'Ticket-Firma GmbH' })
			.returning();
		const [ticket] = await db
			.insert(schema.tickets)
			.values({ subject: 'Zuordnung', companyId: company.id })
			.returning();

		await db.delete(schema.companies).where(eq(schema.companies.id, company.id));

		const rows = await db.select().from(schema.tickets).where(eq(schema.tickets.id, ticket.id));
		expect(rows).toHaveLength(1);
		expect(rows[0].companyId).toBeNull();
	});

	it('lehnt doppelte graph-message-ids ab (dedupe-schutz)', async () => {
		const [ticket] = await db.insert(schema.tickets).values({ subject: 'Dedupe' }).returning();
		const row = {
			ticketId: ticket.id,
			kind: 'inbound' as const,
			bodyHtml: '<p>x</p>',
			graphMessageId: 'AAMkAGI1-abc'
		};
		await db.insert(schema.ticketMessages).values(row);
		await expect(db.insert(schema.ticketMessages).values(row)).rejects.toThrowError();
	});
});
