import { redirect, type Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { env } from '$env/dynamic/private';
import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { db } from '$lib/server/db';
import { createGraphClient } from '$lib/server/graph/client';
import { startTicketSync } from '$lib/server/tickets/poller';
import { createLexofficeClient } from '$lib/server/lexoffice/client';
import { startInvoiceSync } from '$lib/server/lexoffice/sync';

// Mail-Sync einmalig starten — nur zur Laufzeit und nur wenn aktiv geschaltet
if (!building && env.TICKET_SYNC === 'on') {
	if (!env.MS_TENANT_ID || !env.MS_CLIENT_ID || !env.MS_CLIENT_SECRET || !env.SUPPORT_MAILBOX) {
		console.error('Ticket-Sync: TICKET_SYNC=on, aber MS_*-Variablen fehlen — Sync bleibt aus.');
	} else {
		startTicketSync(
			db,
			createGraphClient({
				MS_TENANT_ID: env.MS_TENANT_ID,
				MS_CLIENT_ID: env.MS_CLIENT_ID,
				MS_CLIENT_SECRET: env.MS_CLIENT_SECRET,
				SUPPORT_MAILBOX: env.SUPPORT_MAILBOX
			})
		);
		console.log('Ticket-Sync gestartet (Intervall 90 s).');
	}
}

// Rechnungs-Sync (stündlich) — nur wenn aktiv geschaltet und Key vorhanden
if (!building && env.LEXOFFICE_SYNC === 'on') {
	if (!env.LEXOFFICE_API_KEY) {
		console.error('Rechnungs-Sync: LEXOFFICE_SYNC=on, aber LEXOFFICE_API_KEY fehlt — Sync bleibt aus.');
	} else {
		startInvoiceSync(db, createLexofficeClient(env.LEXOFFICE_API_KEY));
		console.log('Rechnungs-Sync gestartet (stündlich).');
	}
}

// Ohne Login erreichbar
const PUBLIC_PATHS = ['/login', '/passwort', '/api/auth'];

function isPublic(pathname: string): boolean {
	return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Zentraler Zugriffs-Guard. WICHTIG: Layout-load-Guards greifen NICHT bei
 * Form Actions — Authentifizierung und Rollentrennung müssen deshalb hier
 * vor dem Routing durchgesetzt werden. Die Layout-Guards bleiben als zweite
 * Verteidigungslinie bestehen.
 */
const handleBetterAuth: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	const path = event.url.pathname;
	if (!isPublic(path)) {
		if (!session) redirect(302, '/login');

		const isCustomer = session.user.role === 'customer';
		const inPortal = path === '/portal' || path.startsWith('/portal/');
		const isLogout = path === '/logout';

		if (isCustomer && !inPortal && !isLogout) redirect(302, '/portal');
		if (!isCustomer && inPortal) redirect(302, '/');

		// Interne 2FA-Pflicht gilt auch für Actions
		if (
			!isCustomer &&
			!session.user.twoFactorEnabled &&
			!path.startsWith('/einstellungen/sicherheit') &&
			!isLogout
		) {
			redirect(302, '/einstellungen/sicherheit');
		}
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = handleBetterAuth;
