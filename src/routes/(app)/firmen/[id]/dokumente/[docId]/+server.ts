import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { getDocument } from '$lib/server/documents/documents';
import { storedFilePath } from '$lib/server/documents/storage';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const document = await getDocument(db, params.docId);
	if (!document || document.companyId !== params.id) error(404, 'Dokument nicht gefunden');

	const stream = Readable.toWeb(
		createReadStream(storedFilePath(document.storagePath))
	) as ReadableStream;

	// Dateiname RFC-5987-kodiert, damit Umlaute im Download-Namen funktionieren
	const encoded = encodeURIComponent(document.fileName);

	return new Response(stream, {
		headers: {
			'Content-Type': document.mimeType,
			'Content-Length': String(document.sizeBytes),
			'Content-Disposition': `attachment; filename*=UTF-8''${encoded}`
		}
	});
};
