import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { auth } from '$lib/server/auth';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		const code = String(form.get('code') ?? '').trim();
		const useBackup = form.get('backup') === 'on';

		if (!code) return fail(400, { message: 'Code eingeben.' });

		try {
			if (useBackup) {
				await auth.api.verifyBackupCode({ body: { code }, headers: request.headers });
			} else {
				await auth.api.verifyTOTP({ body: { code }, headers: request.headers });
			}
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { message: 'Code ungültig. Neuen Code aus der App eingeben.' });
			}
			throw error;
		}

		redirect(302, '/');
	}
};
