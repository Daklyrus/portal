import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { auth } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user) redirect(302, locals.user.role === 'customer' ? '/portal' : '/');
	return {
		passwordChanged: url.searchParams.get('passwort') === 'neu',
		resetRequested: url.searchParams.get('reset') === 'angefordert'
	};
};

export const actions: Actions = {
	signin: async ({ request }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim();
		const password = String(form.get('password') ?? '');

		if (!email || !password) {
			return fail(400, { message: 'E-Mail und Passwort eingeben.', email });
		}

		let target = '/';
		try {
			const result = await auth.api.signInEmail({
				body: { email, password },
				headers: request.headers
			});
			if ('twoFactorRedirect' in result && result.twoFactorRedirect === true) {
				target = '/login/2fa';
			} else if ('user' in result && (result.user as { role?: string }).role === 'customer') {
				target = '/portal';
			}
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { message: 'E-Mail oder Passwort falsch.', email });
			}
			throw error;
		}

		redirect(302, target);
	},

	forgot: async ({ request }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim();
		if (!email) return fail(400, { message: 'E-Mail eingeben.', email });

		// Immer Erfolg melden — keine Auskunft, welche Adressen ein Konto haben
		try {
			await auth.api.requestPasswordReset({ body: { email, redirectTo: '/passwort' } });
		} catch (error) {
			if (!(error instanceof APIError)) throw error;
		}
		redirect(303, '/login?reset=angefordert');
	}
};
