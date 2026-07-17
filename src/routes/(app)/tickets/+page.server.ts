import { db } from '$lib/server/db';
import { listInternalUsers, listTickets } from '$lib/server/tickets/tickets';
import type { TicketPriority, TicketStatus } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

const STATUS_VALUES = new Set(['open', 'new', 'in_progress', 'waiting_customer', 'resolved', 'closed']);
const PRIORITY_VALUES = new Set(['normal', 'high', 'critical']);

export const load: PageServerLoad = async ({ url }) => {
	const statusParam = url.searchParams.get('status') ?? 'open';
	const priorityParam = url.searchParams.get('priority') ?? '';
	const assigneeParam = url.searchParams.get('bearbeiter') ?? '';

	const status = STATUS_VALUES.has(statusParam) ? (statusParam as TicketStatus | 'open') : 'open';
	const priority = PRIORITY_VALUES.has(priorityParam)
		? (priorityParam as TicketPriority)
		: undefined;

	return {
		tickets: await listTickets(
			db,
			{ status, priority, assignedToId: assigneeParam || undefined },
			new Date()
		),
		users: await listInternalUsers(db),
		filter: { status, priority: priorityParam, bearbeiter: assigneeParam }
	};
};
