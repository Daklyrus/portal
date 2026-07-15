import { error, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { deleteCompany, getCompany } from '$lib/server/companies';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const company = await getCompany(db, params.id);
	if (!company) error(404, 'Firma nicht gefunden');
	return { company };
};

export const actions: Actions = {
	delete: async ({ params }) => {
		await deleteCompany(db, params.id);
		redirect(303, '/firmen');
	}
};
