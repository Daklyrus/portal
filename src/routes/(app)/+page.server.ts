import { db } from '$lib/server/db';
import { getUpcomingDeadlines } from '$lib/server/contracts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return { upcomingDeadlines: await getUpcomingDeadlines(db, 90, new Date()) };
};
