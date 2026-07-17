import { and, asc, desc, eq, inArray, ne, notInArray, sql } from 'drizzle-orm';
import { user } from '../db/auth.schema';
import type { db as defaultDb } from '../db';
import {
	companies,
	contacts,
	tickets,
	ticketAttachments,
	ticketMessages,
	type Company,
	type Contact,
	type NewTicketMessage,
	type Ticket,
	type TicketAttachment,
	type TicketMessage,
	type TicketPriority,
	type TicketStatus
} from '../db/schema';
import { slaStatus, type SlaStatus } from '$lib/tickets/sla';

type Db = typeof defaultDb;

export interface CreateTicketInput {
	subject: string;
	priority?: TicketPriority;
	companyId?: string | null;
	contactId?: string | null;
	requesterEmail?: string | null;
	requesterName?: string | null;
	conversationId?: string | null;
}

export async function createTicket(db: Db, input: CreateTicketInput): Promise<Ticket> {
	const [created] = await db.insert(tickets).values(input).returning();
	return created;
}

export async function addMessage(
	db: Db,
	ticketId: string,
	input: Omit<NewTicketMessage, 'ticketId'>
): Promise<TicketMessage> {
	const [created] = await db
		.insert(ticketMessages)
		.values({ ...input, ticketId })
		.returning();
	await db.update(tickets).set({ updatedAt: new Date() }).where(eq(tickets.id, ticketId));
	return created;
}

export async function findTicketByNumber(db: Db, number: number): Promise<Ticket | undefined> {
	const rows = await db.select().from(tickets).where(eq(tickets.number, number));
	return rows[0];
}

/** Neuestes nicht geschlossenes Ticket zur Graph-Konversation */
export async function findTicketByConversationId(
	db: Db,
	conversationId: string
): Promise<Ticket | undefined> {
	const rows = await db
		.select()
		.from(tickets)
		.where(and(eq(tickets.conversationId, conversationId), ne(tickets.status, 'closed')))
		.orderBy(desc(tickets.createdAt))
		.limit(1);
	return rows[0];
}

export async function findContactByEmail(
	db: Db,
	email: string
): Promise<{ contact: Contact; company: Company } | undefined> {
	const rows = await db
		.select({ contact: contacts, company: companies })
		.from(contacts)
		.innerJoin(companies, eq(contacts.companyId, companies.id))
		.where(sql`lower(${contacts.email}) = ${email.toLowerCase()}`)
		.limit(1);
	return rows[0];
}

export async function setTicketStatus(db: Db, id: string, status: TicketStatus): Promise<void> {
	await db
		.update(tickets)
		.set({ status, closedAt: status === 'closed' ? new Date() : null, updatedAt: new Date() })
		.where(eq(tickets.id, id));
}

/** Zeitpunkt der ersten Techniker-Antwort — nur beim ersten Mal gesetzt */
export async function markFirstResponse(db: Db, id: string, at: Date): Promise<void> {
	await db
		.update(tickets)
		.set({ firstRespondedAt: at })
		.where(and(eq(tickets.id, id), sql`${tickets.firstRespondedAt} is null`));
}

export interface TicketListItem {
	ticket: Ticket;
	company: Company | null;
	assignee: { id: string; name: string } | null;
	sla: SlaStatus;
}

export interface TicketListFilter {
	status?: TicketStatus | 'open';
	priority?: TicketPriority;
	assignedToId?: string;
}

const SLA_ORDER: Record<SlaStatus, number> = { overdue: 0, due_soon: 1, pending: 2, met: 3 };
const PRIORITY_ORDER: Record<TicketPriority, number> = { critical: 0, high: 1, normal: 2 };

/** Ticketliste mit Firma, Bearbeiter und SLA-Zustand; dringendste zuerst */
export async function listTickets(
	db: Db,
	filter: TicketListFilter,
	now: Date
): Promise<TicketListItem[]> {
	const conditions = [];
	if (filter.status === 'open') {
		conditions.push(notInArray(tickets.status, ['resolved', 'closed']));
	} else if (filter.status) {
		conditions.push(eq(tickets.status, filter.status));
	}
	if (filter.priority) conditions.push(eq(tickets.priority, filter.priority));
	if (filter.assignedToId) conditions.push(eq(tickets.assignedToId, filter.assignedToId));

	const rows = await db
		.select({
			ticket: tickets,
			company: companies,
			assignee: { id: user.id, name: user.name }
		})
		.from(tickets)
		.leftJoin(companies, eq(tickets.companyId, companies.id))
		.leftJoin(user, eq(tickets.assignedToId, user.id))
		.where(conditions.length ? and(...conditions) : undefined)
		.orderBy(desc(tickets.createdAt));

	return rows
		.map((row) => ({ ...row, sla: slaStatus(row.ticket, now) }))
		.sort(
			(a, b) =>
				SLA_ORDER[a.sla] - SLA_ORDER[b.sla] ||
				PRIORITY_ORDER[a.ticket.priority] - PRIORITY_ORDER[b.ticket.priority] ||
				a.ticket.createdAt.getTime() - b.ticket.createdAt.getTime()
		);
}

export interface TicketDetail {
	ticket: Ticket;
	company: Company | null;
	contact: Contact | null;
	messages: (TicketMessage & {
		attachments: TicketAttachment[];
		author: { name: string } | null;
	})[];
}

export async function getTicketDetail(db: Db, id: string): Promise<TicketDetail | undefined> {
	const rows = await db
		.select({ ticket: tickets, company: companies, contact: contacts })
		.from(tickets)
		.leftJoin(companies, eq(tickets.companyId, companies.id))
		.leftJoin(contacts, eq(tickets.contactId, contacts.id))
		.where(eq(tickets.id, id));
	const head = rows[0];
	if (!head) return undefined;

	const messageRows = await db
		.select({ message: ticketMessages, author: { name: user.name } })
		.from(ticketMessages)
		.leftJoin(user, eq(ticketMessages.authorId, user.id))
		.where(eq(ticketMessages.ticketId, id))
		.orderBy(asc(ticketMessages.createdAt));

	const messageIds = messageRows.map((r) => r.message.id);
	const attachments = messageIds.length
		? await db
				.select()
				.from(ticketAttachments)
				.where(inArray(ticketAttachments.messageId, messageIds))
		: [];

	return {
		ticket: head.ticket,
		company: head.company,
		contact: head.contact,
		messages: messageRows.map(({ message, author }) => ({
			...message,
			author,
			attachments: attachments.filter((a) => a.messageId === message.id)
		}))
	};
}

export async function assignTicketCompany(
	db: Db,
	ticketId: string,
	opts: {
		companyId: string;
		contactId?: string | null;
		saveContact?: { firstName: string; lastName: string };
	}
): Promise<void> {
	let contactId = opts.contactId ?? null;

	if (opts.saveContact) {
		const rows = await db.select().from(tickets).where(eq(tickets.id, ticketId));
		const ticket = rows[0];
		const [created] = await db
			.insert(contacts)
			.values({
				companyId: opts.companyId,
				firstName: opts.saveContact.firstName,
				lastName: opts.saveContact.lastName,
				email: ticket?.requesterEmail ?? null
			})
			.returning();
		contactId = created.id;
	}

	await db
		.update(tickets)
		.set({ companyId: opts.companyId, contactId, updatedAt: new Date() })
		.where(eq(tickets.id, ticketId));
}

export async function setTicketPriority(
	db: Db,
	id: string,
	priority: TicketPriority
): Promise<void> {
	await db.update(tickets).set({ priority, updatedAt: new Date() }).where(eq(tickets.id, id));
}

export async function assignTicketUser(
	db: Db,
	id: string,
	assignedToId: string | null
): Promise<void> {
	await db.update(tickets).set({ assignedToId, updatedAt: new Date() }).where(eq(tickets.id, id));
}

export async function listInternalUsers(db: Db): Promise<{ id: string; name: string }[]> {
	return db.select({ id: user.id, name: user.name }).from(user).orderBy(asc(user.name));
}
