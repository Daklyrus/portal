import { eq } from 'drizzle-orm';
import type { db as defaultDb } from './db';
import { appSettings } from './db/schema';

type Db = typeof defaultDb;

export const SETTING_HOURLY_RATE = 'billing.hourlyRateCents';

export async function getSetting(db: Db, key: string): Promise<string | null> {
	const rows = await db.select().from(appSettings).where(eq(appSettings.key, key));
	return rows[0]?.value ?? null;
}

export async function setSetting(db: Db, key: string, value: string): Promise<void> {
	await db
		.insert(appSettings)
		.values({ key, value, updatedAt: new Date() })
		.onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });
}
