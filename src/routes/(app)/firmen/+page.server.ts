import { db } from '$lib/server/db';
import { searchCompanies } from '$lib/server/companies';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const q = url.searchParams.get('q') ?? '';
	return { companies: await searchCompanies(db, q), q };
};
