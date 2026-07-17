import { db } from '$lib/server/db';
import { getUpcomingDeadlines } from '$lib/server/contracts';
import { listTickets } from '$lib/server/tickets/tickets';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const now = new Date();
	const openTickets = await listTickets(db, { status: 'open' }, now);
	return {
		upcomingDeadlines: await getUpcomingDeadlines(db, 90, now),
		ticketStats: {
			open: openTickets.length,
			fresh: openTickets.filter((t) => t.ticket.status === 'new').length,
			overdue: openTickets.filter((t) => t.sla === 'overdue').length
		},
		urgentTickets: openTickets
			.filter((t) => t.sla === 'overdue' || t.sla === 'due_soon')
			.slice(0, 5)
	};
};
