import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { createCompany } from '../companies';
import {
	addMessage,
	assignTicketCompany,
	createTicket,
	getTicketDetail,
	listTickets
} from './tickets';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL ist nicht gesetzt');

const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema });

beforeEach(async () => {
	await db.delete(schema.tickets);
	await db.delete(schema.companies);
	await db.delete(schema.user);
});

afterAll(async () => {
	await client.end();
});

const NOW = new Date('2026-07-16T10:00:00+02:00');

describe('listTickets', () => {
	it('filtert offen/status und sortiert überfällige zuerst', async () => {
		// Überfällig: kritisch, am Vortag erstellt (Frist 2 h längst verstrichen), keine Antwort
		const overdue = await createTicket(db, { subject: 'Überfällig', priority: 'critical' });
		await db
			.update(schema.tickets)
			.set({ createdAt: new Date('2026-07-15T09:00:00+02:00'), status: 'in_progress' })
			.where(eq(schema.tickets.id, overdue.id));

		// Entspannt: normal, gerade erstellt
		await createTicket(db, { subject: 'Frisch', priority: 'normal' });

		// Geschlossen: taucht bei 'open' nicht auf
		const closed = await createTicket(db, { subject: 'Zu' });
		await db
			.update(schema.tickets)
			.set({ status: 'closed' })
			.where(eq(schema.tickets.id, closed.id));

		const open = await listTickets(db, { status: 'open' }, NOW);
		expect(open.map((t) => t.ticket.subject)).toEqual(['Überfällig', 'Frisch']);
		expect(open[0].sla).toBe('overdue');

		const onlyClosed = await listTickets(db, { status: 'closed' }, NOW);
		expect(onlyClosed.map((t) => t.ticket.subject)).toEqual(['Zu']);
	});

	it('liefert firma und bearbeiter mit', async () => {
		const company = await createCompany(db, {
			name: 'Muster GmbH',
			customerNumber: null,
			street: null,
			zip: null,
			city: null,
			email: null,
			phone: null,
			website: null,
			notes: null
		});
		await db
			.insert(schema.user)
			.values({ id: 'tech-1', name: 'Toni Techniker', email: 't@corvion.de', emailVerified: true });
		const ticket = await createTicket(db, { subject: 'Mit allem', companyId: company.id });
		await db
			.update(schema.tickets)
			.set({ assignedToId: 'tech-1' })
			.where(eq(schema.tickets.id, ticket.id));

		const [item] = await listTickets(db, {}, NOW);
		expect(item.company?.name).toBe('Muster GmbH');
		expect(item.assignee?.name).toBe('Toni Techniker');
	});
});

describe('getTicketDetail', () => {
	it('liefert ticket, nachrichten mit anhängen und autor', async () => {
		await db
			.insert(schema.user)
			.values({ id: 'tech-2', name: 'Alex Admin', email: 'a@corvion.de', emailVerified: true });
		const ticket = await createTicket(db, { subject: 'Detail' });
		const message = await addMessage(db, ticket.id, {
			kind: 'outbound',
			authorId: 'tech-2',
			bodyHtml: '<p>Antwort</p>'
		});
		await db.insert(schema.ticketAttachments).values({
			messageId: message.id,
			fileName: 'log.txt',
			storagePath: `tickets/${ticket.id}/x.txt`,
			mimeType: 'text/plain',
			sizeBytes: 4
		});

		const detail = await getTicketDetail(db, ticket.id);
		expect(detail?.ticket.id).toBe(ticket.id);
		expect(detail?.messages).toHaveLength(1);
		expect(detail?.messages[0].author?.name).toBe('Alex Admin');
		expect(detail?.messages[0].attachments[0].fileName).toBe('log.txt');
	});

	it('liefert undefined für unbekannte ids', async () => {
		expect(await getTicketDetail(db, '00000000-0000-0000-0000-000000000000')).toBeUndefined();
	});
});

describe('assignTicketCompany', () => {
	it('ordnet firma zu und legt optional den absender als kontakt an', async () => {
		const company = await createCompany(db, {
			name: 'Zuordnung AG',
			customerNumber: null,
			street: null,
			zip: null,
			city: null,
			email: null,
			phone: null,
			website: null,
			notes: null
		});
		const ticket = await createTicket(db, {
			subject: 'Unbekannt',
			requesterEmail: 'neu@zuordnung.de',
			requesterName: 'Nina Neu'
		});

		await assignTicketCompany(db, ticket.id, {
			companyId: company.id,
			saveContact: { firstName: 'Nina', lastName: 'Neu' }
		});

		const [updated] = await db
			.select()
			.from(schema.tickets)
			.where(eq(schema.tickets.id, ticket.id));
		expect(updated.companyId).toBe(company.id);
		expect(updated.contactId).not.toBeNull();

		const contactRows = await db
			.select()
			.from(schema.contacts)
			.where(eq(schema.contacts.companyId, company.id));
		expect(contactRows[0].email).toBe('neu@zuordnung.de');
		expect(contactRows[0].lastName).toBe('Neu');
	});
});
