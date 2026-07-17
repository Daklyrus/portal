import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGraphClient } from './client';

const env = {
	MS_TENANT_ID: 'tenant-123',
	MS_CLIENT_ID: 'client-456',
	MS_CLIENT_SECRET: 'geheim',
	SUPPORT_MAILBOX: 'support@corvion.de'
};

const tokenResponse = () =>
	new Response(JSON.stringify({ access_token: 'token-abc', expires_in: 3600 }), { status: 200 });

const jsonResponse = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status });

const graphMessage = (id: string) => ({
	id,
	internetMessageId: `<${id}@mail>`,
	conversationId: `conv-${id}`,
	subject: `Betreff ${id}`,
	from: { emailAddress: { name: 'Max Muster', address: 'max@muster.de' } },
	toRecipients: [{ emailAddress: { address: 'support@corvion.de' } }],
	body: { contentType: 'html', content: '<p>Hallo</p>' },
	receivedDateTime: '2026-07-16T08:00:00Z',
	hasAttachments: false
});

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
	fetchMock = vi.fn();
});

function client() {
	return createGraphClient(env, fetchMock as unknown as typeof fetch);
}

describe('graph-client token', () => {
	it('holt das token einmal und cached es', async () => {
		fetchMock
			.mockResolvedValueOnce(tokenResponse())
			.mockResolvedValueOnce(jsonResponse({ value: [], '@odata.deltaLink': 'https://delta/1' }))
			.mockResolvedValueOnce(jsonResponse({ value: [], '@odata.deltaLink': 'https://delta/2' }));

		const c = client();
		await c.deltaMessages('inbox', 'https://delta/0');
		await c.deltaMessages('inbox', 'https://delta/1');

		const tokenCalls = fetchMock.mock.calls.filter(([url]) =>
			String(url).includes('login.microsoftonline.com/tenant-123')
		);
		expect(tokenCalls).toHaveLength(1);
		const [, opts] = fetchMock.mock.calls[1];
		expect(opts.headers.Authorization).toBe('Bearer token-abc');
	});

	it('erneuert das token nach 401 genau einmal', async () => {
		fetchMock
			.mockResolvedValueOnce(tokenResponse())
			.mockResolvedValueOnce(new Response('', { status: 401 }))
			.mockResolvedValueOnce(tokenResponse())
			.mockResolvedValueOnce(jsonResponse({ value: [], '@odata.deltaLink': 'https://delta/1' }));

		const result = await client().deltaMessages('inbox', 'https://delta/0');
		expect(result.deltaLink).toBe('https://delta/1');
	});
});

describe('deltaMessages', () => {
	it('folgt nextLinks und sammelt alle nachrichten', async () => {
		fetchMock
			.mockResolvedValueOnce(tokenResponse())
			.mockResolvedValueOnce(
				jsonResponse({ value: [graphMessage('a')], '@odata.nextLink': 'https://next/2' })
			)
			.mockResolvedValueOnce(
				jsonResponse({ value: [graphMessage('b')], '@odata.deltaLink': 'https://delta/neu' })
			);

		const result = await client().deltaMessages('inbox', 'https://delta/alt');
		expect(result.messages.map((m) => m.id)).toEqual(['a', 'b']);
		expect(result.messages[0].from).toEqual({ name: 'Max Muster', address: 'max@muster.de' });
		expect(result.deltaLink).toBe('https://delta/neu');
	});

	it('verwirft beim erstlauf ohne deltalink alle nachrichten (kein alt-import)', async () => {
		fetchMock
			.mockResolvedValueOnce(tokenResponse())
			.mockResolvedValueOnce(
				jsonResponse({ value: [graphMessage('alt')], '@odata.deltaLink': 'https://delta/init' })
			);

		const result = await client().deltaMessages('inbox', null);
		expect(result.messages).toEqual([]);
		expect(result.deltaLink).toBe('https://delta/init');
	});
});

describe('sendMail', () => {
	it('postet betreff, html-body und empfänger', async () => {
		fetchMock
			.mockResolvedValueOnce(tokenResponse())
			.mockResolvedValueOnce(new Response('', { status: 202 }));

		await client().sendMail({
			subject: 'Re: Drucker [#T-1042]',
			html: '<p>Erledigt</p>',
			to: ['max@muster.de']
		});

		const [url, opts] = fetchMock.mock.calls[1];
		expect(String(url)).toBe(
			'https://graph.microsoft.com/v1.0/users/support@corvion.de/sendMail'
		);
		const body = JSON.parse(opts.body);
		expect(body.message.subject).toBe('Re: Drucker [#T-1042]');
		expect(body.message.body).toEqual({ contentType: 'HTML', content: '<p>Erledigt</p>' });
		expect(body.message.toRecipients).toEqual([{ emailAddress: { address: 'max@muster.de' } }]);
		expect(body.saveToSentItems).toBe(true);
	});
});

describe('moveToFolder', () => {
	it('findet den zielordner und verschiebt die nachricht', async () => {
		fetchMock
			.mockResolvedValueOnce(tokenResponse())
			.mockResolvedValueOnce(
				jsonResponse({ value: [{ id: 'folder-1', displayName: 'Im Tool' }] })
			)
			.mockResolvedValueOnce(jsonResponse({ id: 'msg-neu' }, 201));

		await client().moveToFolder('msg-1', 'Im Tool');

		const [moveUrl, moveOpts] = fetchMock.mock.calls[2];
		expect(String(moveUrl)).toContain('/messages/msg-1/move');
		expect(JSON.parse(moveOpts.body)).toEqual({ destinationId: 'folder-1' });
	});

	it('legt den ordner an, wenn er fehlt, und cached die id', async () => {
		fetchMock
			.mockResolvedValueOnce(tokenResponse())
			.mockResolvedValueOnce(jsonResponse({ value: [] })) // Suche: nicht gefunden
			.mockResolvedValueOnce(jsonResponse({ id: 'folder-neu', displayName: 'Im Tool' }, 201))
			.mockResolvedValueOnce(jsonResponse({ id: 'msg-a' }, 201))
			.mockResolvedValueOnce(jsonResponse({ id: 'msg-b' }, 201));

		const c = client();
		await c.moveToFolder('msg-1', 'Im Tool');
		await c.moveToFolder('msg-2', 'Im Tool');

		const folderLookups = fetchMock.mock.calls.filter(([url]) =>
			String(url).includes('/mailFolders?')
		);
		expect(folderLookups).toHaveLength(1);
	});
});
