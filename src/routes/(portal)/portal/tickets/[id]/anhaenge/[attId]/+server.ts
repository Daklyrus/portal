import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { error } from '@sveltejs/kit';
import { and, eq, ne } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { ticketAttachments, ticketMessages, tickets } from '$lib/server/db/schema';
import { storedFilePath } from '$lib/server/documents/storage';
import { getPortalContext } from '$lib/server/portal/access';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const portal = await getPortalContext(db, locals.user?.id ?? '');
	if (!portal) error(403, 'Kein Portal-Zugang.');

	// Firmen-Bindung + keine Anhänge interner Notizen
	const rows = await db
		.select({ attachment: ticketAttachments })
		.from(ticketAttachments)
		.innerJoin(ticketMessages, eq(ticketAttachments.messageId, ticketMessages.id))
		.innerJoin(tickets, eq(ticketMessages.ticketId, tickets.id))
		.where(
			and(
				eq(ticketAttachments.id, params.attId),
				eq(tickets.id, params.id),
				eq(tickets.companyId, portal.companyId),
				ne(ticketMessages.kind, 'note')
			)
		);

	const row = rows[0];
	if (!row) error(404, 'Anhang nicht gefunden');

	const stream = Readable.toWeb(
		createReadStream(storedFilePath(row.attachment.storagePath))
	) as ReadableStream;
	const encoded = encodeURIComponent(row.attachment.fileName);

	return new Response(stream, {
		headers: {
			'Content-Type': row.attachment.mimeType,
			'Content-Length': String(row.attachment.sizeBytes),
			'Content-Disposition': `attachment; filename*=UTF-8''${encoded}`
		}
	});
};
