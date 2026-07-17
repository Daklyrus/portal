import { db } from '$lib/server/db';
import { listPortalTickets } from '$lib/server/portal/tickets';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { portal } = await parent();
	return { tickets: await listPortalTickets(db, portal.companyId) };
};
