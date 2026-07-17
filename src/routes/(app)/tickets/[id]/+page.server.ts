import { error, fail } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { searchCompanies } from '$lib/server/companies';
import { createGraphClient, type GraphClient } from '$lib/server/graph/client';
import {
	addMessage,
	assignTicketCompany,
	assignTicketUser,
	getTicketDetail,
	listInternalUsers,
	setTicketPriority,
	setTicketStatus
} from '$lib/server/tickets/tickets';
import { sendTicketReply } from '$lib/server/tickets/outbound';
import {
	assignCompanySchema,
	assignUserSchema,
	noteSchema,
	prioritySchema,
	replySchema,
	statusSchema
} from '$lib/validation/ticket';
import type { Actions, PageServerLoad } from './$types';

function graphClient(): GraphClient | null {
	if (!env.MS_TENANT_ID || !env.MS_CLIENT_ID || !env.MS_CLIENT_SECRET || !env.SUPPORT_MAILBOX) {
		return null;
	}
	return createGraphClient({
		MS_TENANT_ID: env.MS_TENANT_ID,
		MS_CLIENT_ID: env.MS_CLIENT_ID,
		MS_CLIENT_SECRET: env.MS_CLIENT_SECRET,
		SUPPORT_MAILBOX: env.SUPPORT_MAILBOX
	});
}

export const load: PageServerLoad = async ({ params }) => {
	const detail = await getTicketDetail(db, params.id);
	if (!detail) error(404, 'Ticket nicht gefunden');
	return {
		...detail,
		users: await listInternalUsers(db),
		companies: await searchCompanies(db, '')
	};
};

export const actions: Actions = {
	reply: async ({ params, request, locals }) => {
		const raw = Object.fromEntries(await request.formData());
		const parsed = replySchema.safeParse(raw);
		if (!parsed.success) {
			return fail(400, { replyErrors: parsed.error.flatten().fieldErrors, replyValues: raw });
		}
		const detail = await getTicketDetail(db, params.id);
		if (!detail) error(404, 'Ticket nicht gefunden');

		const graph = graphClient();
		if (!graph) {
			const replyErrors: Record<string, string[]> = {
				to: ['Mailversand nicht konfiguriert (MS_*-Variablen fehlen).']
			};
			return fail(400, { replyErrors, replyValues: raw });
		}

		await sendTicketReply(db, graph, {
			ticket: detail.ticket,
			authorId: locals.user?.id ?? '',
			bodyHtml: parsed.data.bodyHtml,
			to: parsed.data.to,
			setStatus: parsed.data.setStatus
		});
		return { ticketSaved: true };
	},

	note: async ({ params, request, locals }) => {
		const raw = Object.fromEntries(await request.formData());
		const parsed = noteSchema.safeParse(raw);
		if (!parsed.success) {
			return fail(400, { noteErrors: parsed.error.flatten().fieldErrors, noteValues: raw });
		}
		await addMessage(db, params.id, {
			kind: 'note',
			authorId: locals.user?.id ?? null,
			bodyHtml: parsed.data.bodyHtml
		});
		return { ticketSaved: true };
	},

	setStatus: async ({ params, request }) => {
		const parsed = statusSchema.safeParse(Object.fromEntries(await request.formData()));
		if (!parsed.success) return fail(400, { message: 'Status prüfen' });
		await setTicketStatus(db, params.id, parsed.data.status);
		return { ticketSaved: true };
	},

	setPriority: async ({ params, request }) => {
		const parsed = prioritySchema.safeParse(Object.fromEntries(await request.formData()));
		if (!parsed.success) return fail(400, { message: 'Priorität prüfen' });
		await setTicketPriority(db, params.id, parsed.data.priority);
		return { ticketSaved: true };
	},

	assignUser: async ({ params, request }) => {
		const parsed = assignUserSchema.safeParse(Object.fromEntries(await request.formData()));
		if (!parsed.success) return fail(400, { message: 'Bearbeiter prüfen' });
		await assignTicketUser(db, params.id, parsed.data.assignedToId);
		return { ticketSaved: true };
	},

	assignCompany: async ({ params, request }) => {
		const raw = Object.fromEntries(await request.formData());
		const parsed = assignCompanySchema.safeParse(raw);
		if (!parsed.success) {
			return fail(400, { assignErrors: parsed.error.flatten().fieldErrors, assignValues: raw });
		}
		await assignTicketCompany(db, params.id, {
			companyId: parsed.data.companyId,
			contactId: parsed.data.contactId,
			saveContact: parsed.data.saveContact
				? { firstName: parsed.data.firstName, lastName: parsed.data.lastName }
				: undefined
		});
		return { ticketSaved: true };
	}
};
