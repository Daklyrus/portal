import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../db/schema';
import { runSyncOnce, startTicketSync } from './poller';
import type { GraphClient, GraphMessage } from '../graph/client';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL ist nicht gesetzt');

const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema });

let counter = 0;
function mail(overrides: Partial<GraphMessage> = {}): GraphMessage {
	counter += 1;
	return {
		id: `poll-${counter}`,
		internetMessageId: `<poll-${counter}@extern>`,
		conversationId: `conv-poll-${counter}`,
		subject: `Anfrage ${counter}`,
		from: { name: 'Max', address: 'max@muster.de' },
		toRecipients: ['support@corvion.de'],
		body: { contentType: 'html', content: '<p>Hilfe</p>' },
		receivedDateTime: '2026-07-16T08:00:00Z',
		hasAttachments: false,
		...overrides
	};
}

function makeGraph(inbox: GraphMessage[], sent: GraphMessage[] = []): GraphClient {
	return {
		deltaMessages: vi.fn(async (folder: 'inbox' | 'sentitems', deltaLink: string | null) => ({
			messages: folder === 'inbox' ? inbox : sent,
			deltaLink: `https://delta/${folder}/${deltaLink === null ? 'init' : 'next'}`
		})),
		getAttachments: vi.fn().mockResolvedValue([]),
		sendMail: vi.fn().mockResolvedValue(undefined),
		moveToFolder: vi.fn().mockResolvedValue(undefined)
	};
}

beforeEach(async () => {
	await db.delete(schema.tickets);
	await db.delete(schema.syncState);
});

afterAll(async () => {
	await client.end();
});

describe('runSyncOnce', () => {
	it('verarbeitet inbox und gesendete, persistiert delta-links', async () => {
		const graph = makeGraph([mail(), mail()]);

		const result = await runSyncOnce(db, graph);

		expect(result.processed).toBe(2);
		expect(result.errors).toBe(0);
		expect(await db.select().from(schema.tickets)).toHaveLength(2);

		const state = await db.select().from(schema.syncState);
		const keys = state.map((s) => s.key).sort();
		expect(keys).toEqual(['delta:inbox', 'delta:sentitems']);
	});

	it('übergibt beim zweiten lauf den gespeicherten delta-link', async () => {
		const graph = makeGraph([]);
		await runSyncOnce(db, graph);
		await runSyncOnce(db, graph);

		const inboxCalls = (graph.deltaMessages as ReturnType<typeof vi.fn>).mock.calls.filter(
			([folder]) => folder === 'inbox'
		);
		expect(inboxCalls[0][1]).toBeNull();
		expect(inboxCalls[1][1]).toBe('https://delta/inbox/init');
	});

	it('macht bei einer kaputten nachricht weiter und zählt den fehler', async () => {
		const bad = mail({ subject: 'Kaputt' });
		const good = mail({ subject: 'Geht' });
		const graph = makeGraph([bad, good]);
		// moveToFolder schlägt nur für die erste Nachricht fehl
		(graph.moveToFolder as ReturnType<typeof vi.fn>).mockImplementation(async (id: string) => {
			if (id === bad.id) throw new Error('Graph down');
		});

		const result = await runSyncOnce(db, graph);

		expect(result.errors).toBe(1);
		expect(result.processed).toBe(1);
		// Delta-Link trotzdem gespeichert, Sync bleibt nicht hängen
		expect(await db.select().from(schema.syncState)).toHaveLength(2);
	});
});

describe('startTicketSync', () => {
	it('tickt im intervall, überlappt nicht und lässt sich stoppen', async () => {
		vi.useFakeTimers();
		let running = 0;
		let maxConcurrent = 0;
		let calls = 0;

		// langsamer Sync-Lauf: dauert 3 Intervalle
		const slowSync = async () => {
			calls += 1;
			running += 1;
			maxConcurrent = Math.max(maxConcurrent, running);
			await new Promise((resolve) => setTimeout(resolve, 3000));
			running -= 1;
			return { processed: 0, errors: 0 };
		};

		const stop = startTicketSync(db, makeGraph([]), 1000, slowSync);
		await vi.advanceTimersByTimeAsync(10_000);
		stop();
		const callsAtStop = calls;
		await vi.advanceTimersByTimeAsync(5_000);

		expect(maxConcurrent).toBe(1);
		expect(calls).toBeGreaterThanOrEqual(2);
		expect(calls).toBe(callsAtStop);
		vi.useRealTimers();
	});
});
