import { error, fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { getPortalContext } from '$lib/server/portal/access';
import { createPortalTicket } from '$lib/server/portal/tickets';
import { portalTicketSchema } from '$lib/validation/portal';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const portal = await getPortalContext(db, locals.user?.id ?? '');
		if (!portal) error(403, 'Kein Portal-Zugang.');

		const form = await request.formData();
		const parsed = portalTicketSchema.safeParse({
			subject: form.get('subject'),
			body: form.get('body')
		});
		if (!parsed.success) {
			return fail(400, {
				errors: parsed.error.flatten().fieldErrors,
				values: { subject: String(form.get('subject') ?? ''), body: String(form.get('body') ?? '') }
			});
		}

		const files = form.getAll('files').filter((f): f is File => f instanceof File);
		const ticket = await createPortalTicket(db, portal, parsed.data, files);
		redirect(303, `/portal/tickets/${ticket.id}`);
	}
};
