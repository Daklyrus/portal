import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { ticketAttachments, ticketMessages } from '$lib/server/db/schema';
import { storedFilePath } from '$lib/server/documents/storage';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const rows = await db
		.select({ attachment: ticketAttachments, message: ticketMessages })
		.from(ticketAttachments)
		.innerJoin(ticketMessages, eq(ticketAttachments.messageId, ticketMessages.id))
		.where(eq(ticketAttachments.id, params.attId));

	const row = rows[0];
	if (!row || row.message.ticketId !== params.id) error(404, 'Anhang nicht gefunden');

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
