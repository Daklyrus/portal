import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { createLexofficeClient } from '$lib/server/lexoffice/client';
import { getPortalContext } from '$lib/server/portal/access';
import { getPortalInvoice } from '$lib/server/portal/queries';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const portal = await getPortalContext(db, locals.user?.id ?? '');
	if (!portal) error(403, 'Kein Portal-Zugang.');

	const invoice = await getPortalInvoice(db, portal.companyId, params.id);
	if (!invoice) error(404, 'Rechnung nicht gefunden');

	if (!env.LEXOFFICE_API_KEY) {
		error(503, 'Rechnungsabruf derzeit nicht möglich. Bitte wenden Sie sich an support@corvion.de.');
	}

	const lex = createLexofficeClient(env.LEXOFFICE_API_KEY);
	const pdf = await lex.getInvoicePdf(invoice.lexofficeId);
	const encoded = encodeURIComponent(pdf.fileName);

	return new Response(pdf.data, {
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': `attachment; filename*=UTF-8''${encoded}`
		}
	});
};
