import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './db/schema';
import { getSetting, setSetting } from './settings';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL ist nicht gesetzt');

const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema });

beforeEach(async () => {
	await db.delete(schema.appSettings);
});

afterAll(async () => {
	await client.end();
});

describe('settings', () => {
	it('liefert null für unbekannte keys', async () => {
		expect(await getSetting(db, 'gibt.es.nicht')).toBeNull();
	});

	it('setzt und überschreibt werte (upsert)', async () => {
		await setSetting(db, 'billing.hourlyRateCents', '9500');
		expect(await getSetting(db, 'billing.hourlyRateCents')).toBe('9500');

		await setSetting(db, 'billing.hourlyRateCents', '10500');
		expect(await getSetting(db, 'billing.hourlyRateCents')).toBe('10500');
	});
});
