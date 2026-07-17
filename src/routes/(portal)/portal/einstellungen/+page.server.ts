import { fail } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import QRCode from 'qrcode';
import { auth } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	return { twoFactorEnabled: locals.user?.twoFactorEnabled ?? false };
};

export const actions: Actions = {
	enable: async ({ request }) => {
		const form = await request.formData();
		const password = String(form.get('password') ?? '');
		if (!password) return fail(400, { message: 'Passwort eingeben.' });

		try {
			const result = await auth.api.enableTwoFactor({
				body: { password },
				headers: request.headers
			});
			const qrDataUrl = await QRCode.toDataURL(result.totpURI, { width: 220, margin: 1 });
			const secret = new URL(result.totpURI).searchParams.get('secret') ?? '';
			return { totpUri: result.totpURI, secret, backupCodes: result.backupCodes, qrDataUrl };
		} catch (error) {
			if (error instanceof APIError) return fail(400, { message: 'Passwort falsch.' });
			throw error;
		}
	},

	verify: async ({ request }) => {
		const form = await request.formData();
		const code = String(form.get('code') ?? '').trim();
		if (!code) return fail(400, { message: 'Code eingeben.' });

		try {
			await auth.api.verifyTOTP({ body: { code }, headers: request.headers });
			return { verified: true };
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { message: 'Code ungültig. Neuen Code aus der App eingeben.' });
			}
			throw error;
		}
	},

	disable: async ({ request }) => {
		const form = await request.formData();
		const password = String(form.get('password') ?? '');
		if (!password) return fail(400, { message: 'Passwort eingeben.' });

		try {
			await auth.api.disableTwoFactor({ body: { password }, headers: request.headers });
			return { disabled: true };
		} catch (error) {
			if (error instanceof APIError) return fail(400, { message: 'Passwort falsch.' });
			throw error;
		}
	}
};
