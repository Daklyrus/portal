import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import { resolve } from 'node:path';
import { rm } from 'node:fs/promises';
import * as schema from '../db/schema';
import { addMessage, createTicket, setTicketStatus } from '../tickets/tickets';
import type { PortalContext } from './access';
import {
	addPortalReply,
	confirmResolved,
	createPortalTicket,
	getPortalTicketDetail,
	listPortalTickets,
	reopenTicket
} from './tickets';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL ist nicht gesetzt');

const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema });

const UPLOAD_ROOT = resolve('data-test/portal-uploads');

let ownCompanyId: string;
let otherCompanyId: string;
let ctx: PortalContext;

beforeEach(async () => {
	await db.delete(schema.tickets);
	await db.delete(schema.companies);
	const [own] = await db.insert(schema.companies).values({ name: 'Eigene GmbH' }).returning();
	const [other] = await db.insert(schema.companies).values({ name: 'Fremde AG' }).returning();
	ownCompanyId = own.id;
	otherCompanyId = other.id;
	const [contact] = await db
		.insert(schema.contacts)
		.values({ companyId: ownCompanyId, firstName: 'Petra', lastName: 'Portal', email: 'p@eigene.de' })
		.returning();
	ctx = { userId: 'portal-user', contactId: contact.id, companyId: ownCompanyId };
});

afterAll(async () => {
	await client.end();
	await rm(resolve('data-test'), { recursive: true, force: true });
});

function makeFile(name: string, content = 'inhalt'): File {
	return new File([content], name, { type: 'text/plain' });
}

describe('listPortalTickets / getPortalTicketDetail', () => {
	it('liefert nur tickets der eigenen firma', async () => {
		await createTicket(db, { subject: 'Eigenes', companyId: ownCompanyId });
		await createTicket(db, { subject: 'Fremdes', companyId: otherCompanyId });

		const list = await listPortalTickets(db, ownCompanyId);
		expect(list.map((t) => t.ticket.subject)).toEqual(['Eigenes']);
	});

	it('blendet interne notizen im verlauf aus und verweigert fremde tickets', async () => {
		const own = await createTicket(db, { subject: 'Mit Verlauf', companyId: ownCompanyId });
		await addMessage(db, own.id, { kind: 'inbound', bodyHtml: '<p>Kunde</p>' });
		await addMessage(db, own.id, { kind: 'note', bodyHtml: '<p>GEHEIM</p>' });
		await addMessage(db, own.id, { kind: 'outbound', bodyHtml: '<p>Antwort</p>' });

		const detail = await getPortalTicketDetail(db, ownCompanyId, own.id);
		expect(detail?.messages.map((m) => m.kind)).toEqual(['inbound', 'outbound']);

		const fremd = await createTicket(db, { subject: 'Fremd', companyId: otherCompanyId });
		expect(await getPortalTicketDetail(db, ownCompanyId, fremd.id)).toBeUndefined();
	});
});

describe('createPortalTicket', () => {
	it('legt ticket mit firma, kontakt und escaped html an, speichert anhänge', async () => {
		const ticket = await createPortalTicket(
			db,
			ctx,
			{ subject: 'Drucker <kaputt>', body: 'Zeile 1\nMit <b>Tags</b>' },
			[makeFile('log.txt')],
			{ uploadRoot: UPLOAD_ROOT }
		);

		expect(ticket.companyId).toBe(ownCompanyId);
		expect(ticket.contactId).toBe(ctx.contactId);
		expect(ticket.requesterEmail).toBe('p@eigene.de');

		const detail = await getPortalTicketDetail(db, ownCompanyId, ticket.id);
		expect(detail?.messages[0].bodyHtml).not.toContain('<b>');
		expect(detail?.messages[0].bodyHtml).toContain('&lt;b&gt;');
		expect(detail?.messages[0].attachments).toHaveLength(1);
	});
});

describe('addPortalReply', () => {
	it('hängt kundenantworten an und öffnet gelöste tickets wieder', async () => {
		const ticket = await createTicket(db, { subject: 'Reopen', companyId: ownCompanyId });
		await setTicketStatus(db, ticket.id, 'resolved');

		await addPortalReply(db, ctx, ticket.id, 'Ist doch noch kaputt', [], {
			uploadRoot: UPLOAD_ROOT
		});

		const [after] = await db.select().from(schema.tickets).where(eq(schema.tickets.id, ticket.id));
		expect(after.status).toBe('in_progress');
		const detail = await getPortalTicketDetail(db, ownCompanyId, ticket.id);
		expect(detail?.messages.at(-1)?.kind).toBe('inbound');
	});

	it('verweigert antworten auf fremde tickets', async () => {
		const fremd = await createTicket(db, { subject: 'Fremd', companyId: otherCompanyId });
		await expect(
			addPortalReply(db, ctx, fremd.id, 'Hack', [], { uploadRoot: UPLOAD_ROOT })
		).rejects.toThrowError();
	});
});

describe('confirmResolved / reopenTicket', () => {
	it('schließt nur gelöste tickets der eigenen firma bzw. öffnet sie wieder', async () => {
		const ticket = await createTicket(db, { subject: 'Bestätigen', companyId: ownCompanyId });
		await setTicketStatus(db, ticket.id, 'resolved');

		await confirmResolved(db, ownCompanyId, ticket.id);
		let [after] = await db.select().from(schema.tickets).where(eq(schema.tickets.id, ticket.id));
		expect(after.status).toBe('closed');

		// reopen wirkt nur aus resolved — geschlossen bleibt geschlossen
		await reopenTicket(db, ownCompanyId, ticket.id);
		[after] = await db.select().from(schema.tickets).where(eq(schema.tickets.id, ticket.id));
		expect(after.status).toBe('closed');

		const zwei = await createTicket(db, { subject: 'Widerspruch', companyId: ownCompanyId });
		await setTicketStatus(db, zwei.id, 'resolved');
		await reopenTicket(db, ownCompanyId, zwei.id);
		const [reopened] = await db.select().from(schema.tickets).where(eq(schema.tickets.id, zwei.id));
		expect(reopened.status).toBe('in_progress');

		// fremde firma darf nichts bestätigen
		const fremd = await createTicket(db, { subject: 'Fremd', companyId: otherCompanyId });
		await setTicketStatus(db, fremd.id, 'resolved');
		await confirmResolved(db, ownCompanyId, fremd.id);
		const [untouched] = await db.select().from(schema.tickets).where(eq(schema.tickets.id, fremd.id));
		expect(untouched.status).toBe('resolved');
	});
});
