import sanitizeHtml from 'sanitize-html';
import { env } from '$env/dynamic/private';
import type { db as defaultDb } from '../db';
import { ticketAttachments, ticketMessages, type Ticket } from '../db/schema';
import { eq } from 'drizzle-orm';
import { saveBuffer, UploadError } from '../documents/storage';
import { parseTicketNumber, subjectWithNumber } from '$lib/tickets/subject';
import type { GraphClient, GraphMessage, OutgoingMail } from '../graph/client';
import {
	addMessage,
	createTicket,
	findContactByEmail,
	findTicketByConversationId,
	findTicketByNumber,
	setTicketStatus
} from './tickets';

type Db = typeof defaultDb;

const PROCESSED_FOLDER = 'Im Tool';

export interface IngestOptions {
	uploadRoot?: string;
	supportMailbox?: string;
}

/** Eingehendes Mail-HTML auf ein sicheres Subset reduzieren */
export function sanitizeMailHtml(html: string): string {
	return sanitizeHtml(html, {
		allowedTags: [
			'p', 'br', 'div', 'span', 'a', 'ul', 'ol', 'li', 'b', 'strong', 'i', 'em', 'u',
			'h1', 'h2', 'h3', 'h4', 'pre', 'code', 'blockquote', 'img', 'hr', 'table', 'thead',
			'tbody', 'tr', 'td', 'th'
		],
		allowedAttributes: {
			a: ['href'],
			img: ['src', 'alt']
		},
		allowedSchemes: ['https', 'http', 'mailto', 'cid'],
		disallowedTagsMode: 'discard'
	});
}

export function buildConfirmationMail(ticket: Ticket): OutgoingMail {
	const subject = subjectWithNumber(`Re: ${ticket.subject}`, ticket.number);
	const html = [
		'<p>Guten Tag,</p>',
		`<p>Ihre Anfrage ist bei uns eingegangen und wird unter der Ticketnummer <strong>T-${ticket.number}</strong> bearbeitet.</p>`,
		'<p>Bitte lassen Sie den Betreff bei Antworten unverändert, damit Ihre Nachricht dem Vorgang zugeordnet wird.</p>',
		'<p>Mit freundlichen Grüßen<br>Ihr Corvion-Team</p>'
	].join('');
	return { subject, html, to: ticket.requesterEmail ? [ticket.requesterEmail] : [] };
}

async function isDuplicate(db: Db, graphMessageId: string): Promise<boolean> {
	const rows = await db
		.select({ id: ticketMessages.id })
		.from(ticketMessages)
		.where(eq(ticketMessages.graphMessageId, graphMessageId))
		.limit(1);
	return rows.length > 0;
}

async function matchTicket(db: Db, msg: GraphMessage): Promise<Ticket | undefined> {
	const number = parseTicketNumber(msg.subject);
	if (number !== null) {
		const byNumber = await findTicketByNumber(db, number);
		if (byNumber) return byNumber;
	}
	if (msg.conversationId) {
		return findTicketByConversationId(db, msg.conversationId);
	}
	return undefined;
}

async function storeAttachments(
	db: Db,
	graph: GraphClient,
	msg: GraphMessage,
	messageId: string,
	ticketId: string,
	uploadRoot: string | undefined
): Promise<string[]> {
	if (!msg.hasAttachments) return [];
	const warnings: string[] = [];
	const attachments = await graph.getAttachments(msg.id);
	for (const attachment of attachments) {
		try {
			const stored = await saveBuffer(
				Buffer.from(attachment.contentBytes, 'base64'),
				attachment.name,
				`tickets/${ticketId}`,
				attachment.contentType,
				uploadRoot
			);
			await db.insert(ticketAttachments).values({
				messageId,
				fileName: attachment.name,
				storagePath: stored.storagePath,
				mimeType: stored.mimeType,
				sizeBytes: stored.sizeBytes
			});
		} catch (error) {
			if (error instanceof UploadError) {
				warnings.push(`Anhang „${attachment.name}" nicht übernommen: ${error.message}`);
			} else {
				throw error;
			}
		}
	}
	return warnings;
}

export async function processInboxMessage(
	db: Db,
	graph: GraphClient,
	msg: GraphMessage,
	opts: IngestOptions = {}
): Promise<'created' | 'appended' | 'skipped'> {
	const supportMailbox = (opts.supportMailbox ?? env.SUPPORT_MAILBOX ?? '').toLowerCase();

	if (await isDuplicate(db, msg.id)) return 'skipped';
	// Eigene Mails in der Inbox (z. B. Kopien) nie verarbeiten — verhindert Bestätigungs-Schleifen
	if (msg.from.address.toLowerCase() === supportMailbox) return 'skipped';

	const bodyHtml = sanitizeMailHtml(msg.body.content);
	const existing = await matchTicket(db, msg);

	if (existing) {
		const message = await addMessage(db, existing.id, {
			kind: 'inbound',
			fromEmail: msg.from.address,
			subject: msg.subject,
			bodyHtml,
			graphMessageId: msg.id,
			internetMessageId: msg.internetMessageId,
			sentAt: msg.receivedDateTime ? new Date(msg.receivedDateTime) : null
		});
		await appendAttachmentWarnings(
			db,
			message.id,
			await storeAttachments(db, graph, msg, message.id, existing.id, opts.uploadRoot)
		);
		if (existing.status === 'waiting_customer' || existing.status === 'resolved') {
			await setTicketStatus(db, existing.id, 'in_progress');
		}
		await graph.moveToFolder(msg.id, PROCESSED_FOLDER);
		return 'appended';
	}

	const match = await findContactByEmail(db, msg.from.address);
	const ticket = await createTicket(db, {
		subject: msg.subject || '(Kein Betreff)',
		companyId: match?.company.id ?? null,
		contactId: match?.contact.id ?? null,
		requesterEmail: msg.from.address,
		requesterName: msg.from.name || null,
		conversationId: msg.conversationId || null
	});

	const message = await addMessage(db, ticket.id, {
		kind: 'inbound',
		fromEmail: msg.from.address,
		subject: msg.subject,
		bodyHtml,
		graphMessageId: msg.id,
		internetMessageId: msg.internetMessageId,
		sentAt: msg.receivedDateTime ? new Date(msg.receivedDateTime) : null
	});
	await appendAttachmentWarnings(
		db,
		message.id,
		await storeAttachments(db, graph, msg, message.id, ticket.id, opts.uploadRoot)
	);

	const confirmation = buildConfirmationMail(ticket);
	if (confirmation.to.length > 0) {
		await graph.sendMail(confirmation);
		await addMessage(db, ticket.id, {
			kind: 'outbound',
			fromEmail: supportMailbox || null,
			toEmails: confirmation.to.join(', '),
			subject: confirmation.subject,
			bodyHtml: confirmation.html,
			sentAt: new Date()
		});
	}

	await graph.moveToFolder(msg.id, PROCESSED_FOLDER);
	return 'created';
}

async function appendAttachmentWarnings(db: Db, messageId: string, warnings: string[]) {
	if (warnings.length === 0) return;
	const note = warnings.map((w) => `<p><em>${w}</em></p>`).join('');
	const rows = await db
		.select()
		.from(ticketMessages)
		.where(eq(ticketMessages.id, messageId));
	await db
		.update(ticketMessages)
		.set({ bodyHtml: note + rows[0].bodyHtml })
		.where(eq(ticketMessages.id, messageId));
}

/** Aus Outlook gesendete Antworten in den Ticket-Verlauf übernehmen */
export async function processSentMessage(
	db: Db,
	msg: GraphMessage
): Promise<'appended' | 'skipped'> {
	if (await isDuplicate(db, msg.id)) return 'skipped';

	const ticket = await matchTicket(db, msg);
	if (!ticket) return 'skipped';

	await addMessage(db, ticket.id, {
		kind: 'outbound',
		fromEmail: msg.from.address,
		toEmails: msg.toRecipients.join(', '),
		subject: msg.subject,
		bodyHtml: sanitizeMailHtml(msg.body.content),
		graphMessageId: msg.id,
		internetMessageId: msg.internetMessageId,
		sentAt: msg.receivedDateTime ? new Date(msg.receivedDateTime) : null
	});
	return 'appended';
}
