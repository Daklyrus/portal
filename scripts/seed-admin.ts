// Legt den ersten Admin an. Ausführung: npm run seed:admin
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin, twoFactor } from 'better-auth/plugins';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from '../src/lib/server/db/schema';

const { DATABASE_URL, BETTER_AUTH_SECRET, ORIGIN, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD } =
	process.env;

if (!DATABASE_URL || !BETTER_AUTH_SECRET || !SEED_ADMIN_EMAIL || !SEED_ADMIN_PASSWORD) {
	console.error(
		'Fehlende Umgebungsvariablen: DATABASE_URL, BETTER_AUTH_SECRET, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD'
	);
	process.exit(1);
}

const client = postgres(DATABASE_URL, { max: 1 });
const db = drizzle(client, { schema });

const auth = betterAuth({
	appName: 'Corvion Tool',
	baseURL: ORIGIN,
	secret: BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'pg' }),
	emailAndPassword: { enabled: true },
	plugins: [admin(), twoFactor()]
});

const existing = await db
	.select()
	.from(schema.user)
	.where(eq(schema.user.email, SEED_ADMIN_EMAIL));

if (existing.length > 0) {
	console.log(`Admin ${SEED_ADMIN_EMAIL} existiert bereits — nichts zu tun.`);
} else {
	await auth.api.signUpEmail({
		body: { email: SEED_ADMIN_EMAIL, password: SEED_ADMIN_PASSWORD, name: 'Admin' }
	});
	await db
		.update(schema.user)
		.set({ role: 'admin' })
		.where(eq(schema.user.email, SEED_ADMIN_EMAIL));
	console.log(`Admin ${SEED_ADMIN_EMAIL} angelegt. Passwort nach dem ersten Login ändern.`);
}

await client.end();
