import { and, eq, notInArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { invoices, tickets } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { portal } = await parent();

	const openTickets = await db
		.select({ id: tickets.id })
		.from(tickets)
		.where(
			and(eq(tickets.companyId, portal.companyId), notInArray(tickets.status, ['resolved', 'closed']))
		);
	const openInvoices = await db
		.select({ id: invoices.id })
		.from(invoices)
		.where(and(eq(invoices.companyId, portal.companyId), notInArray(invoices.status, ['paid', 'voided'])));

	return { openTicketCount: openTickets.length, openInvoiceCount: openInvoices.length };
};
