import { fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { searchCompanies } from '$lib/server/companies';
import { listContacts } from '$lib/server/contacts';
import { createGraphClient } from '$lib/server/graph/client';
import { addMessage, createTicket } from '$lib/server/tickets/tickets';
import { sendTicketReply } from '$lib/server/tickets/outbound';
import { manualTicketSchema } from '$lib/validation/ticket';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const companyId = url.searchParams.get('firma');
	return {
		companies: await searchCompanies(db, ''),
		contacts: companyId ? await listContacts(db, companyId) : [],
		selectedCompanyId: companyId ?? ''
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const raw = Object.fromEntries(await request.formData());
		const parsed = manualTicketSchema.safeParse(raw);
		if (!parsed.success) {
			return fail(400, { errors: parsed.error.flatten().fieldErrors, values: raw });
		}
		const input = parsed.data;

		const ticket = await createTicket(db, {
			subject: input.subject,
			priority: input.priority,
			companyId: input.companyId,
			contactId: input.contactId,
			requesterEmail: input.to || null
		});

		if (input.description) {
			await addMessage(db, ticket.id, {
				kind: 'note',
				authorId: locals.user?.id ?? null,
				bodyHtml: `<p>${input.description}</p>`
			});
		}

		const wantsMail = input.initialMailHtml.replace(/<p>\s*<\/p>/g, '').trim() !== '';
		if (wantsMail && input.to) {
			if (!env.MS_TENANT_ID || !env.MS_CLIENT_ID || !env.MS_CLIENT_SECRET || !env.SUPPORT_MAILBOX) {
				const errors: Record<string, string[]> = {
					to: ['Mailversand nicht konfiguriert (MS_*-Variablen fehlen).']
				};
				return fail(400, { errors, values: raw });
			}
			const graph = createGraphClient({
				MS_TENANT_ID: env.MS_TENANT_ID,
				MS_CLIENT_ID: env.MS_CLIENT_ID,
				MS_CLIENT_SECRET: env.MS_CLIENT_SECRET,
				SUPPORT_MAILBOX: env.SUPPORT_MAILBOX
			});
			await sendTicketReply(db, graph, {
				ticket,
				authorId: locals.user?.id ?? '',
				bodyHtml: input.initialMailHtml,
				to: input.to
			});
		}

		redirect(303, `/tickets/${ticket.id}`);
	}
};
