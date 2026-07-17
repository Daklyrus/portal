import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	if (!locals.user) redirect(302, '/login');

	// Kunden haben im internen Bereich nichts verloren
	if (locals.user.role === 'customer') redirect(302, '/portal');

	// 2FA ist für interne Nutzer Pflicht — ohne aktives 2FA nur die Sicherheitsseite
	if (!locals.user.twoFactorEnabled && !url.pathname.startsWith('/einstellungen/sicherheit')) {
		redirect(302, '/einstellungen/sicherheit');
	}

	return { user: locals.user };
};
