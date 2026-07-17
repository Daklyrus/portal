import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { env } from '$env/dynamic/private';
import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { db } from '$lib/server/db';
import { createGraphClient } from '$lib/server/graph/client';
import { startTicketSync } from '$lib/server/tickets/poller';

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

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = handleBetterAuth;
