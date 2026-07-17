import { error, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { getCompany } from '$lib/server/companies';
import { getPortalContext } from '$lib/server/portal/access';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/login');
	if (locals.user.role !== 'customer') redirect(302, '/');

	const portal = await getPortalContext(db, locals.user.id);
	if (!portal) error(403, 'Kein Portal-Zugang für dieses Konto.');

	const company = await getCompany(db, portal.companyId);
	return {
		user: locals.user,
		portal: { ...portal, companyName: company?.name ?? '' }
	};
};
