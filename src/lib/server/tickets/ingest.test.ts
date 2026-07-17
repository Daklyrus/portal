import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import { resolve } from 'node:path';
import { rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import * as schema from '../db/schema';
import { createCompany } from '../companies';
import { createContact } from '../contacts';
import { processInboxMessage, processSentMessage } from './ingest';
import type { GraphClient, GraphMessage } from '../graph/client';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL ist nicht gesetzt');

const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema });

const UPLOAD_ROOT = resolve('data-test/ticket-uploads');

function makeGraphMock() {
	return {
		deltaMessages: vi.fn(),
		getAttachments: vi.fn().mockResolvedValue([]),
		sendMail: vi.fn().mockResolvedValue(undefined),
		moveToFolder: vi.fn().mockResolvedValue(undefined)
	} satisfies GraphClient;
}

let counter = 0;
function mail(overrides: Partial<GraphMessage> = {}): GraphMessage {
	counter += 1;
	return {
		id: `graph-${counter}`,
		internetMessageId: `<msg-${counter}@extern>`,
		conversationId: `conv-${counter}`,
		subject: 'Drucker druckt nicht',
		from: { name: 'Max Muster', address: 'max@muster.de' },
		toRecipients: ['support@corvion.de'],
		body: { contentType: 'html', content: '<p>Bitte um Hilfe.</p>' },
		receivedDateTime: '2026-07-16T08:00:00Z',
		hasAttachments: false,
		...overrides
	};
}

beforeEach(async () => {
	await db.delete(schema.tickets);
	await db.delete(schema.companies);
});

afterAll(async () => {
	await client.end();
	await rm(resolve('data-test'), { recursive: true, force: true });
});

describe('processInboxMessage — neue tickets', () => {
	it('legt bei unbekanntem absender ein ticket ohne firma an, bestätigt und verschiebt', async () => {
		const graph = makeGraphMock();
		const msg = mail();

		const result = await processInboxMessage(db, graph, msg, { uploadRoot: UPLOAD_ROOT });
		expect(result).toBe('created');

		const [ticket] = await db.select().from(schema.tickets);
		expect(ticket.subject).toBe('Drucker druckt nicht');
		expect(ticket.companyId).toBeNull();
		expect(ticket.requesterEmail).toBe('max@muster.de');
		expect(ticket.conversationId).toBe(msg.conversationId);
		expect(ticket.status).toBe('new');

		// Bestätigung mit Ticketnummer im Betreff
		expect(graph.sendMail).toHaveBeenCalledOnce();
		const sent = graph.sendMail.mock.calls[0][0];
		expect(sent.to).toEqual(['max@muster.de']);
		expect(sent.subject).toContain(`[#T-${ticket.number}]`);

		expect(graph.moveToFolder).toHaveBeenCalledWith(msg.id, 'Im Tool');

		// inbound + persistierte Bestätigung
		const messages = await db.select().from(schema.ticketMessages);
		expect(messages.map((m) => m.kind).sort()).toEqual(['inbound', 'outbound']);
	});

	it('ordnet bekannte absender ihrer firma und ihrem kontakt zu', async () => {
		const company = await createCompany(db, {
			name: 'Muster GmbH',
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
		const contact = await createContact(db, company.id, {
			firstName: 'Max',
			lastName: 'Muster',
			position: null,
			email: 'MAX@muster.de',
			phone: null,
			mobile: null,
			notes: null
		});

		await processInboxMessage(db, makeGraphMock(), mail(), { uploadRoot: UPLOAD_ROOT });

		const [ticket] = await db.select().from(schema.tickets);
		expect(ticket.companyId).toBe(company.id);
		expect(ticket.contactId).toBe(contact.id);
	});

	it('bereinigt gefährliches html', async () => {
		await processInboxMessage(
			db,
			makeGraphMock(),
			mail({ body: { contentType: 'html', content: '<p>ok</p><script>alert(1)</script>' } }),
			{ uploadRoot: UPLOAD_ROOT }
		);
		const [message] = await db
			.select()
			.from(schema.ticketMessages)
			.where(eq(schema.ticketMessages.kind, 'inbound'));
		expect(message.bodyHtml).toContain('<p>ok</p>');
		expect(message.bodyHtml).not.toContain('script');
	});

	it('speichert anhänge über die storage-schicht', async () => {
		const graph = makeGraphMock();
		graph.getAttachments.mockResolvedValue([
			{
				name: 'log.txt',
				contentType: 'text/plain',
				size: 5,
				contentBytes: Buffer.from('hallo').toString('base64')
			}
		]);

		await processInboxMessage(db, graph, mail({ hasAttachments: true }), {
			uploadRoot: UPLOAD_ROOT
		});

		const [attachment] = await db.select().from(schema.ticketAttachments);
		expect(attachment.fileName).toBe('log.txt');
		expect(attachment.sizeBytes).toBe(5);
		expect(existsSync(resolve(UPLOAD_ROOT, attachment.storagePath))).toBe(true);
	});
});

describe('processInboxMessage — threading', () => {
	it('hängt antworten mit ticketnummer im betreff ans bestehende ticket', async () => {
		const graph = makeGraphMock();
		await processInboxMessage(db, graph, mail(), { uploadRoot: UPLOAD_ROOT });
		const [ticket] = await db.select().from(schema.tickets);

		const result = await processInboxMessage(
			db,
			graph,
			mail({ subject: `Re: Drucker druckt nicht [#T-${ticket.number}]`, conversationId: 'anders' }),
			{ uploadRoot: UPLOAD_ROOT }
		);

		expect(result).toBe('appended');
		expect(await db.select().from(schema.tickets)).toHaveLength(1);
		// Bestätigung nur beim ersten Mal
		expect(graph.sendMail).toHaveBeenCalledOnce();
	});

	it('nutzt die conversation-id als fallback ohne nummer im betreff', async () => {
		const graph = makeGraphMock();
		const first = mail();
		await processInboxMessage(db, graph, first, { uploadRoot: UPLOAD_ROOT });

		const result = await processInboxMessage(
			db,
			graph,
			mail({ subject: 'AW: Drucker', conversationId: first.conversationId }),
			{ uploadRoot: UPLOAD_ROOT }
		);

		expect(result).toBe('appended');
		expect(await db.select().from(schema.tickets)).toHaveLength(1);
	});

	it('öffnet gelöste tickets bei kundenantwort wieder', async () => {
		const graph = makeGraphMock();
		const first = mail();
		await processInboxMessage(db, graph, first, { uploadRoot: UPLOAD_ROOT });
		const [ticket] = await db.select().from(schema.tickets);
		await db
			.update(schema.tickets)
			.set({ status: 'resolved' })
			.where(eq(schema.tickets.id, ticket.id));

		await processInboxMessage(
			db,
			graph,
			mail({ conversationId: first.conversationId }),
			{ uploadRoot: UPLOAD_ROOT }
		);

		const [reopened] = await db.select().from(schema.tickets);
		expect(reopened.status).toBe('in_progress');
	});

	it('verarbeitet dieselbe graph-message nur einmal', async () => {
		const graph = makeGraphMock();
		const msg = mail();
		await processInboxMessage(db, graph, msg, { uploadRoot: UPLOAD_ROOT });
		const result = await processInboxMessage(db, graph, msg, { uploadRoot: UPLOAD_ROOT });

		expect(result).toBe('skipped');
		expect(await db.select().from(schema.tickets)).toHaveLength(1);
	});

	it('ignoriert mails der eigenen support-adresse (keine bestätigungs-schleife)', async () => {
		const result = await processInboxMessage(
			db,
			makeGraphMock(),
			mail({ from: { name: 'Corvion', address: 'support@corvion.de' } }),
			{ uploadRoot: UPLOAD_ROOT }
		);
		expect(result).toBe('skipped');
		expect(await db.select().from(schema.tickets)).toHaveLength(0);
	});
});

describe('processSentMessage', () => {
	it('hängt aus outlook gesendete antworten mit nummer als outbound an', async () => {
		const graph = makeGraphMock();
		await processInboxMessage(db, graph, mail(), { uploadRoot: UPLOAD_ROOT });
		const [ticket] = await db.select().from(schema.tickets);

		const result = await processSentMessage(
			db,
			mail({
				subject: `Re: Drucker [#T-${ticket.number}]`,
				from: { name: 'Corvion', address: 'support@corvion.de' },
				toRecipients: ['max@muster.de']
			})
		);

		expect(result).toBe('appended');
		const outbound = await db
			.select()
			.from(schema.ticketMessages)
			.where(eq(schema.ticketMessages.kind, 'outbound'));
		// Bestätigung + Outlook-Antwort
		expect(outbound).toHaveLength(2);
	});

	it('überspringt gesendete mails ohne ticket-bezug', async () => {
		const result = await processSentMessage(db, mail({ subject: 'Angebot Neukunde' }));
		expect(result).toBe('skipped');
	});
});
