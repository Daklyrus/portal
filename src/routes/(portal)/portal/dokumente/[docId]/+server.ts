import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { storedFilePath } from '$lib/server/documents/storage';
import { getPortalContext } from '$lib/server/portal/access';
import { getSharedDocument } from '$lib/server/portal/queries';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const portal = await getPortalContext(db, locals.user?.id ?? '');
	if (!portal) error(403, 'Kein Portal-Zugang.');

	// Prüft Firma UND Freigabe — der interne Download-Endpoint kennt keine Freigabe-Prüfung
	const document = await getSharedDocument(db, portal.companyId, params.docId);
	if (!document) error(404, 'Dokument nicht gefunden');

	const stream = Readable.toWeb(
		createReadStream(storedFilePath(document.storagePath))
	) as ReadableStream;
	const encoded = encodeURIComponent(document.fileName);

	return new Response(stream, {
		headers: {
			'Content-Type': document.mimeType,
			'Content-Length': String(document.sizeBytes),
			'Content-Disposition': `attachment; filename*=UTF-8''${encoded}`
		}
	});
};
