import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { createCompany } from '$lib/server/companies';
import { companySchema } from '$lib/validation/company';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request }) => {
		const raw = Object.fromEntries(await request.formData());
		const parsed = companySchema.safeParse(raw);

		if (!parsed.success) {
			return fail(400, { errors: parsed.error.flatten().fieldErrors, values: raw });
		}

		const company = await createCompany(db, parsed.data);
		redirect(303, `/firmen/${company.id}`);
	}
};
