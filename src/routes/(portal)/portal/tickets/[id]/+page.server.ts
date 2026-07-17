import { error, fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { getPortalContext, type PortalContext } from '$lib/server/portal/access';
import {
	addPortalReply,
	confirmResolved,
	getPortalTicketDetail,
	reopenTicket
} from '$lib/server/portal/tickets';
import { portalReplySchema } from '$lib/validation/portal';
import type { Actions, PageServerLoad } from './$types';

async function requirePortal(userId: string | undefined): Promise<PortalContext> {
	const portal = await getPortalContext(db, userId ?? '');
	if (!portal) error(403, 'Kein Portal-Zugang.');
	return portal;
}

export const load: PageServerLoad = async ({ params, parent }) => {
	const { portal } = await parent();
	const detail = await getPortalTicketDetail(db, portal.companyId, params.id);
	if (!detail) error(404, 'Anfrage nicht gefunden');
	return detail;
};

export const actions: Actions = {
	reply: async ({ params, request, locals }) => {
		const portal = await requirePortal(locals.user?.id);
		const form = await request.formData();
		const parsed = portalReplySchema.safeParse({ body: form.get('body') });
		if (!parsed.success) {
			return fail(400, { errors: parsed.error.flatten().fieldErrors });
		}
		const files = form.getAll('files').filter((f): f is File => f instanceof File);
		await addPortalReply(db, portal, params.id, parsed.data.body, files);
		return { saved: true };
	},

	confirm: async ({ params, locals }) => {
		const portal = await requirePortal(locals.user?.id);
		await confirmResolved(db, portal.companyId, params.id);
		return { saved: true };
	},

	reopen: async ({ params, locals }) => {
		const portal = await requirePortal(locals.user?.id);
		await reopenTicket(db, portal.companyId, params.id);
		return { saved: true };
	}
};
