import { db } from '$lib/server/db';
import { listPortalInvoices } from '$lib/server/portal/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { portal } = await parent();
	return { invoices: await listPortalInvoices(db, portal.companyId) };
};
