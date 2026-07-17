import { db } from '$lib/server/db';
import { listSharedDocuments } from '$lib/server/portal/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { portal } = await parent();
	return { documents: await listSharedDocuments(db, portal.companyId) };
};
