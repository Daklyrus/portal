import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin, twoFactor } from 'better-auth/plugins';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { env } from '$env/dynamic/private';
import { getRequestEvent } from '$app/server';
import { db as defaultDb } from '$lib/server/db';

interface AuthOptions {
	/** false in Tests/Skripten ohne SvelteKit-Request-Kontext */
	requestCookies?: boolean;
	/** true nur für Seed: legt den ersten Nutzer an */
	allowSignUp?: boolean;
}

export function createAuth(db: typeof defaultDb, opts: AuthOptions = {}) {
	return betterAuth({
		appName: 'Corvion Tool',
		baseURL: env.ORIGIN,
		secret: env.BETTER_AUTH_SECRET,
		database: drizzleAdapter(db, { provider: 'pg' }),
		emailAndPassword: { enabled: true, disableSignUp: !opts.allowSignUp },
		plugins: [
			admin(),
			twoFactor(),
			// sveltekitCookies muss das letzte Plugin sein
			...(opts.requestCookies === false ? [] : [sveltekitCookies(getRequestEvent)])
		]
	});
}

export const auth = createAuth(defaultDb);
