import { db } from '$lib/server/db';
import { searchCompanies } from '$lib/server/companies';
import { monthlyTimeReport } from '$lib/server/time-entries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const companies = await searchCompanies(db, '');
	const companyId = url.searchParams.get('firma') ?? '';
	const month =
		url.searchParams.get('monat') ?? new Date().toISOString().slice(0, 7); /* 'yyyy-MM' */

	const validCompany = companies.find((c) => c.id === companyId);
	const report =
		validCompany && /^\d{4}-\d{2}$/.test(month)
			? await monthlyTimeReport(db, validCompany.id, month)
			: null;

	return { companies, companyId, month, report };
};
