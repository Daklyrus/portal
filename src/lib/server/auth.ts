import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin, twoFactor } from 'better-auth/plugins';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { env } from '$env/dynamic/private';
import { getRequestEvent } from '$app/server';
import { db as defaultDb } from '$lib/server/db';
import { createGraphClient, type GraphClient } from '$lib/server/graph/client';

export interface ResetPasswordMail {
	user: { email: string; name: string };
	link: string;
}

interface AuthOptions {
	/** false in Tests/Skripten ohne SvelteKit-Request-Kontext */
	requestCookies?: boolean;
	/** true nur für Seed und Portal-Zugangs-Anlage */
	allowSignUp?: boolean;
	/** Test-Hook: ersetzt den Mailversand des Passwort-Links */
	onResetPassword?: (mail: ResetPasswordMail) => Promise<void>;
}

let graphForMails: GraphClient | null = null;

/** Passwort-Link per Graph verschicken; ohne MS-Konfiguration nur ins Log (Dev) */
async function sendResetPasswordMail({ user, link }: ResetPasswordMail): Promise<void> {
	if (!env.MS_TENANT_ID || !env.MS_CLIENT_ID || !env.MS_CLIENT_SECRET || !env.SUPPORT_MAILBOX) {
		console.warn(`Passwort-Link für ${user.email} (Mailversand nicht konfiguriert): ${link}`);
		return;
	}
	graphForMails ??= createGraphClient({
		MS_TENANT_ID: env.MS_TENANT_ID,
		MS_CLIENT_ID: env.MS_CLIENT_ID,
		MS_CLIENT_SECRET: env.MS_CLIENT_SECRET,
		SUPPORT_MAILBOX: env.SUPPORT_MAILBOX
	});
	await graphForMails.sendMail({
		subject: 'Corvion-Portal: Passwort festlegen',
		html: [
			`<p>Guten Tag${user.name ? ` ${user.name}` : ''},</p>`,
			'<p>über den folgenden Link legen Sie Ihr Passwort für das Corvion-Portal fest. Der Link ist 48 Stunden gültig:</p>',
			`<p><a href="${link}">${link}</a></p>`,
			'<p>Falls Sie diese Nachricht nicht erwartet haben, können Sie sie ignorieren.</p>',
			'<p>Mit freundlichen Grüßen<br>Ihr Corvion-Team</p>'
		].join(''),
		to: [user.email]
	});
}

export function createAuth(db: typeof defaultDb, opts: AuthOptions = {}) {
	return betterAuth({
		appName: 'Corvion Tool',
		baseURL: env.ORIGIN,
		secret: env.BETTER_AUTH_SECRET,
		database: drizzleAdapter(db, { provider: 'pg' }),
		emailAndPassword: {
			enabled: true,
			disableSignUp: !opts.allowSignUp,
			resetPasswordTokenExpiresIn: 60 * 60 * 48,
			sendResetPassword: async ({ user, token }) => {
				const base = env.APP_URL ?? env.ORIGIN ?? 'http://localhost:5173';
				const mail: ResetPasswordMail = {
					user: { email: user.email, name: user.name ?? '' },
					link: `${base}/passwort?token=${token}`
				};
				await (opts.onResetPassword ?? sendResetPasswordMail)(mail);
			}
		},
		plugins: [
			admin(),
			twoFactor(),
			// sveltekitCookies muss das letzte Plugin sein
			...(opts.requestCookies === false ? [] : [sveltekitCookies(getRequestEvent)])
		]
	});
}

export const auth = createAuth(defaultDb);
