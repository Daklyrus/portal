import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './db/schema';
import { createAuth } from './auth';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL ist nicht gesetzt');

const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema });

// Seed-Instanz: Registrierung offen (wie im Seed-Skript), keine Request-Cookies
const seedAuth = createAuth(db, { requestCookies: false, allowSignUp: true });
// Produktiv-Verhalten: Registrierung gesperrt
const prodAuth = createAuth(db, { requestCookies: false });

const credentials = { email: 'test@corvion.de', password: 'sicheres-passwort-123', name: 'Test Nutzer' };

beforeEach(async () => {
	await db.delete(schema.user);
});

afterAll(async () => {
	await client.end();
});

describe('auth', () => {
	it('meldet einen angelegten Nutzer mit korrektem Passwort an', async () => {
		await seedAuth.api.signUpEmail({ body: credentials });

		const result = await prodAuth.api.signInEmail({
			body: { email: credentials.email, password: credentials.password }
		});

		expect(result.user.email).toBe(credentials.email);
		expect(result.token).toBeTruthy();
	});

	it('lehnt ein falsches Passwort ab', async () => {
		await seedAuth.api.signUpEmail({ body: credentials });

		await expect(
			prodAuth.api.signInEmail({
				body: { email: credentials.email, password: 'falsches-passwort' }
			})
		).rejects.toThrowError();
	});

	it('blockiert öffentliche Registrierung', async () => {
		await expect(prodAuth.api.signUpEmail({ body: credentials })).rejects.toThrowError();
	});
});
