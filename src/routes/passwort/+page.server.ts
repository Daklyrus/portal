import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { auth } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	return { token: url.searchParams.get('token') ?? '' };
};

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		const token = String(form.get('token') ?? '');
		const newPassword = String(form.get('newPassword') ?? '');
		const confirm = String(form.get('confirm') ?? '');

		if (newPassword.length < 12) {
			return fail(400, { message: 'Mindestens 12 Zeichen.' });
		}
		if (newPassword !== confirm) {
			return fail(400, { message: 'Die Passwörter stimmen nicht überein.' });
		}

		try {
			await auth.api.resetPassword({ body: { newPassword, token } });
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, {
					message: 'Link ungültig oder abgelaufen. Fordere über die Anmeldeseite einen neuen an.'
				});
			}
			throw error;
		}

		redirect(303, '/login?passwort=neu');
	}
};
