import type { db as defaultDb } from '../db';
import type { Ticket, TicketMessage, TicketStatus } from '../db/schema';
import type { GraphClient } from '../graph/client';
import { subjectWithNumber } from '$lib/tickets/subject';
import { sanitizeMailHtml } from './ingest';
import { addMessage, markFirstResponse, setTicketStatus } from './tickets';

type Db = typeof defaultDb;

export const MAIL_SIGNATURE_HTML =
	'<p>Mit freundlichen Grüßen<br>Ihr Corvion-Team<br>support@corvion.de</p>';

/** Inhalt + Signatur in ein mail-taugliches Grundlayout packen */
export function wrapOutboundHtml(bodyHtml: string): string {
	return [
		'<div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #1f2937;">',
		bodyHtml,
		'<hr style="border: none; border-top: 1px solid #d1d5db; margin: 16px 0;">',
		MAIL_SIGNATURE_HTML,
		'</div>'
	].join('\n');
}

export interface SendReplyOptions {
	ticket: Ticket;
	authorId: string;
	bodyHtml: string;
	to: string;
	setStatus?: TicketStatus;
}

export async function sendTicketReply(
	db: Db,
	graph: GraphClient,
	opts: SendReplyOptions
): Promise<TicketMessage> {
	const clean = sanitizeMailHtml(opts.bodyHtml);
	const subject = subjectWithNumber(`Re: ${opts.ticket.subject}`, opts.ticket.number);
	const now = new Date();

	await graph.sendMail({ subject, html: wrapOutboundHtml(clean), to: [opts.to] });

	const message = await addMessage(db, opts.ticket.id, {
		kind: 'outbound',
		authorId: opts.authorId,
		toEmails: opts.to,
		subject,
		bodyHtml: clean,
		sentAt: now
	});

	await markFirstResponse(db, opts.ticket.id, now);
	if (opts.setStatus) {
		await setTicketStatus(db, opts.ticket.id, opts.setStatus);
	}
	return message;
}
