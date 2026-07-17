import { eq } from 'drizzle-orm';
import type { db as defaultDb } from '../db';
import { syncState } from '../db/schema';
import type { GraphClient } from '../graph/client';
import { processInboxMessage, processSentMessage } from './ingest';

type Db = typeof defaultDb;

async function readState(db: Db, key: string): Promise<string | null> {
	const rows = await db.select().from(syncState).where(eq(syncState.key, key));
	return rows[0]?.value ?? null;
}

async function writeState(db: Db, key: string, value: string): Promise<void> {
	await db
		.insert(syncState)
		.values({ key, value, updatedAt: new Date() })
		.onConflictDoUpdate({ target: syncState.key, set: { value, updatedAt: new Date() } });
}

/** Ein Sync-Durchlauf: Inbox + Gesendete. Fehler je Nachricht stoppen den Lauf nicht. */
export async function runSyncOnce(
	db: Db,
	graph: GraphClient
): Promise<{ processed: number; errors: number }> {
	let processed = 0;
	let errors = 0;

	// Inbox
	const inboxDelta = await graph.deltaMessages('inbox', await readState(db, 'delta:inbox'));
	for (const msg of inboxDelta.messages) {
		try {
			const result = await processInboxMessage(db, graph, msg);
			if (result !== 'skipped') processed += 1;
		} catch (error) {
			errors += 1;
			console.error(`Ticket-Sync: Inbox-Nachricht „${msg.subject}" fehlgeschlagen:`, error);
		}
	}
	await writeState(db, 'delta:inbox', inboxDelta.deltaLink);

	// Gesendete Elemente (Outlook-Antworten mit Ticketnummer)
	const sentDelta = await graph.deltaMessages('sentitems', await readState(db, 'delta:sentitems'));
	for (const msg of sentDelta.messages) {
		try {
			const result = await processSentMessage(db, msg);
			if (result !== 'skipped') processed += 1;
		} catch (error) {
			errors += 1;
			console.error(`Ticket-Sync: Gesendet-Nachricht „${msg.subject}" fehlgeschlagen:`, error);
		}
	}
	await writeState(db, 'delta:sentitems', sentDelta.deltaLink);

	return { processed, errors };
}

/** Startet den Poller; überlappende Läufe werden übersprungen. Gibt stop() zurück. */
export function startTicketSync(
	db: Db,
	graph: GraphClient,
	intervalMs = 90_000,
	syncFn: typeof runSyncOnce = runSyncOnce
): () => void {
	let busy = false;

	const tick = async () => {
		if (busy) return;
		busy = true;
		try {
			await syncFn(db, graph);
		} catch (error) {
			console.error('Ticket-Sync: Durchlauf fehlgeschlagen:', error);
		} finally {
			busy = false;
		}
	};

	const timer = setInterval(() => void tick(), intervalMs);
	void tick();
	return () => clearInterval(timer);
}
