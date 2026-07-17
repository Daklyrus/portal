import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { createTicket } from './tickets';
import { sendTicketReply, wrapOutboundHtml } from './outbound';
import type { GraphClient } from '../graph/client';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL ist nicht gesetzt');

const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema });

function makeGraphMock(): GraphClient {
	return {
		deltaMessages: vi.fn(),
		getAttachments: vi.fn(),
		sendMail: vi.fn().mockResolvedValue(undefined),
		moveToFolder: vi.fn()
	};
}

async function makeUser(id: string): Promise<string> {
	await db
		.insert(schema.user)
		.values({ id, name: 'Techniker', email: `${id}@corvion.de`, emailVerified: true });
	return id;
}

beforeEach(async () => {
	await db.delete(schema.tickets);
	await db.delete(schema.user);
});

afterAll(async () => {
	await client.end();
});

describe('sendTicketReply', () => {
	it('sendet mit ticketnummer im betreff und persistiert die outbound-nachricht', async () => {
		const graph = makeGraphMock();
		const userId = await makeUser('tech-1');
		const ticket = await createTicket(db, {
			subject: 'Drucker kaputt',
			requesterEmail: 'max@muster.de'
		});

		await sendTicketReply(db, graph, {
			ticket,
			authorId: userId,
			bodyHtml: '<p>Treiber neu installiert.</p>',
			to: 'max@muster.de'
		});

		const sent = (graph.sendMail as ReturnType<typeof vi.fn>).mock.calls[0][0];
		expect(sent.subject).toBe(`Re: Drucker kaputt [#T-${ticket.number}]`);
		expect(sent.to).toEqual(['max@muster.de']);
		expect(sent.html).toContain('Treiber neu installiert');
		expect(sent.html).toContain('Corvion'); // Signatur

		const messages = await db.select().from(schema.ticketMessages);
		expect(messages).toHaveLength(1);
		expect(messages[0].kind).toBe('outbound');
		expect(messages[0].authorId).toBe(userId);
	});

	it('setzt firstRespondedAt nur beim ersten mal', async () => {
		const graph = makeGraphMock();
		const userId = await makeUser('tech-2');
		const ticket = await createTicket(db, {
			subject: 'Server',
			requesterEmail: 'max@muster.de'
		});

		await sendTicketReply(db, graph, { ticket, authorId: userId, bodyHtml: '<p>1</p>', to: 'max@muster.de' });
		const [afterFirst] = await db.select().from(schema.tickets).where(eq(schema.tickets.id, ticket.id));
		const firstResponse = afterFirst.firstRespondedAt;
		expect(firstResponse).not.toBeNull();

		await new Promise((r) => setTimeout(r, 20));
		await sendTicketReply(db, graph, { ticket, authorId: userId, bodyHtml: '<p>2</p>', to: 'max@muster.de' });
		const [afterSecond] = await db.select().from(schema.tickets).where(eq(schema.tickets.id, ticket.id));
		expect(afterSecond.firstRespondedAt?.getTime()).toBe(firstResponse?.getTime());
	});

	it('wechselt optional den status und bereinigt gefährliches html', async () => {
		const graph = makeGraphMock();
		const userId = await makeUser('tech-3');
		const ticket = await createTicket(db, {
			subject: 'Frage',
			requesterEmail: 'max@muster.de'
		});

		await sendTicketReply(db, graph, {
			ticket,
			authorId: userId,
			bodyHtml: '<p>Bitte testen.</p><script>böse()</script>',
			to: 'max@muster.de',
			setStatus: 'waiting_customer'
		});

		const [updated] = await db.select().from(schema.tickets).where(eq(schema.tickets.id, ticket.id));
		expect(updated.status).toBe('waiting_customer');

		const sent = (graph.sendMail as ReturnType<typeof vi.fn>).mock.calls[0][0];
		expect(sent.html).not.toContain('script');
	});
});

describe('wrapOutboundHtml', () => {
	it('hängt die signatur getrennt an den inhalt', () => {
		const html = wrapOutboundHtml('<p>Inhalt</p>');
		expect(html).toContain('<p>Inhalt</p>');
		expect(html.indexOf('Inhalt')).toBeLessThan(html.indexOf('Corvion'));
	});
});
