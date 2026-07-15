import { error, fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { getCompany, updateCompany } from '$lib/server/companies';
import { companySchema } from '$lib/validation/company';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const company = await getCompany(db, params.id);
	if (!company) error(404, 'Firma nicht gefunden');
	return { company };
};

export const actions: Actions = {
	default: async ({ params, request }) => {
		const raw = Object.fromEntries(await request.formData());
		const parsed = companySchema.safeParse(raw);

		if (!parsed.success) {
			return fail(400, { errors: parsed.error.flatten().fieldErrors, values: raw });
		}

		await updateCompany(db, params.id, parsed.data);
		redirect(303, `/firmen/${params.id}`);
	}
};
