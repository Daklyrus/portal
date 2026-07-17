import { and, asc, desc, eq, inArray, ne } from 'drizzle-orm';
import type { db as defaultDb } from '../db';
import {
	contacts,
	tickets,
	ticketAttachments,
	ticketMessages,
	type Ticket,
	type TicketAttachment,
	type TicketMessage
} from '../db/schema';
import { saveBuffer, UploadError } from '../documents/storage';
import { addMessage, createTicket, setTicketStatus } from '../tickets/tickets';
import type { PortalContext } from './access';

type Db = typeof defaultDb;

export class PortalTicketError extends Error {}

interface PortalFileOptions {
	uploadRoot?: string;
}

/** Klartext aus dem Portal-Formular als sicheres HTML (escaped, Zeilenumbrüche als Absätze) */
export function textToHtml(text: string): string {
	const escaped = text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
	return escaped
		.split(/\n+/)
		.map((line) => `<p>${line.trim()}</p>`)
		.filter((p) => p !== '<p></p>')
		.join('');
}

async function ticketOfCompany(db: Db, companyId: string, ticketId: string): Promise<Ticket | undefined> {
	const rows = await db
		.select()
		.from(tickets)
		.where(and(eq(tickets.id, ticketId), eq(tickets.companyId, companyId)));
	return rows[0];
}

async function storeFiles(
	db: Db,
	messageId: string,
	ticketId: string,
	files: File[],
	opts: PortalFileOptions
): Promise<void> {
	for (const file of files) {
		if (!(file instanceof File) || file.size === 0) continue;
		try {
			const stored = await saveBuffer(
				Buffer.from(await file.arrayBuffer()),
				file.name,
				`tickets/${ticketId}`,
				file.type,
				opts.uploadRoot
			);
			await db.insert(ticketAttachments).values({
				messageId,
				fileName: file.name,
				storagePath: stored.storagePath,
				mimeType: stored.mimeType,
				sizeBytes: stored.sizeBytes
			});
		} catch (error) {
			if (!(error instanceof UploadError)) throw error;
			// Abgelehnte Datei (Typ/Größe) still überspringen — Kern der Nachricht bleibt erhalten
		}
	}
}

export async function listPortalTickets(db: Db, companyId: string): Promise<{ ticket: Ticket }[]> {
	const rows = await db
		.select()
		.from(tickets)
		.where(eq(tickets.companyId, companyId))
		.orderBy(desc(tickets.updatedAt));
	return rows.map((ticket) => ({ ticket }));
}

export interface PortalTicketDetail {
	ticket: Ticket;
	messages: (TicketMessage & { attachments: TicketAttachment[] })[];
}

export async function getPortalTicketDetail(
	db: Db,
	companyId: string,
	ticketId: string
): Promise<PortalTicketDetail | undefined> {
	const ticket = await ticketOfCompany(db, companyId, ticketId);
	if (!ticket) return undefined;

	// Interne Notizen sind für Kunden tabu
	const messageRows = await db
		.select()
		.from(ticketMessages)
		.where(and(eq(ticketMessages.ticketId, ticketId), ne(ticketMessages.kind, 'note')))
		.orderBy(asc(ticketMessages.createdAt));

	const messageIds = messageRows.map((m) => m.id);
	const attachments = messageIds.length
		? await db
				.select()
				.from(ticketAttachments)
				.where(inArray(ticketAttachments.messageId, messageIds))
		: [];

	return {
		ticket,
		messages: messageRows.map((message) => ({
			...message,
			attachments: attachments.filter((a) => a.messageId === message.id)
		}))
	};
}

export async function createPortalTicket(
	db: Db,
	ctx: PortalContext,
	input: { subject: string; body: string },
	files: File[],
	opts: PortalFileOptions = {}
): Promise<Ticket> {
	const contactRows = await db.select().from(contacts).where(eq(contacts.id, ctx.contactId));
	const contact = contactRows[0];

	const ticket = await createTicket(db, {
		subject: input.subject,
		companyId: ctx.companyId,
		contactId: ctx.contactId,
		requesterEmail: contact?.email ?? null,
		requesterName: contact ? `${contact.firstName} ${contact.lastName}` : null
	});

	const message = await addMessage(db, ticket.id, {
		kind: 'inbound',
		fromEmail: contact?.email ?? null,
		bodyHtml: textToHtml(input.body)
	});
	await storeFiles(db, message.id, ticket.id, files, opts);
	return ticket;
}

export async function addPortalReply(
	db: Db,
	ctx: PortalContext,
	ticketId: string,
	body: string,
	files: File[],
	opts: PortalFileOptions = {}
): Promise<void> {
	const ticket = await ticketOfCompany(db, ctx.companyId, ticketId);
	if (!ticket) throw new PortalTicketError('Ticket nicht gefunden.');

	const contactRows = await db.select().from(contacts).where(eq(contacts.id, ctx.contactId));
	const message = await addMessage(db, ticket.id, {
		kind: 'inbound',
		fromEmail: contactRows[0]?.email ?? null,
		bodyHtml: textToHtml(body)
	});
	await storeFiles(db, message.id, ticket.id, files, opts);

	if (ticket.status === 'waiting_customer' || ticket.status === 'resolved') {
		await setTicketStatus(db, ticket.id, 'in_progress');
	}
}

/** Kunde bestätigt die Lösung: Gelöst → Geschlossen */
export async function confirmResolved(db: Db, companyId: string, ticketId: string): Promise<void> {
	const ticket = await ticketOfCompany(db, companyId, ticketId);
	if (ticket?.status === 'resolved') await setTicketStatus(db, ticketId, 'closed');
}

/** Kunde widerspricht der Lösung: Gelöst → In Arbeit */
export async function reopenTicket(db: Db, companyId: string, ticketId: string): Promise<void> {
	const ticket = await ticketOfCompany(db, companyId, ticketId);
	if (ticket?.status === 'resolved') await setTicketStatus(db, ticketId, 'in_progress');
}
