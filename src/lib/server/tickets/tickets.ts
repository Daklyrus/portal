import { and, desc, eq, ne, sql } from 'drizzle-orm';
import type { db as defaultDb } from '../db';
import {
	companies,
	contacts,
	tickets,
	ticketMessages,
	type Company,
	type Contact,
	type NewTicketMessage,
	type Ticket,
	type TicketMessage,
	type TicketPriority,
	type TicketStatus
} from '../db/schema';

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
