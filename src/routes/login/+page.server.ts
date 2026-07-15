import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { auth } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) redirect(302, '/');
};

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim();
		const password = String(form.get('password') ?? '');

		if (!email || !password) {
			return fail(400, { message: 'E-Mail und Passwort eingeben.', email });
		}

		let needsTwoFactor = false;
		try {
			const result = await auth.api.signInEmail({
				body: { email, password },
				headers: request.headers
			});
			needsTwoFactor = 'twoFactorRedirect' in result && result.twoFactorRedirect === true;
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { message: 'E-Mail oder Passwort falsch.', email });
			}
			throw error;
		}

		redirect(302, needsTwoFactor ? '/login/2fa' : '/');
	}
};
