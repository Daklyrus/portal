// Schlanker Microsoft-Graph-Client für die Shared Mailbox (Client-Credentials-Flow).
// Bewusst ohne SDK: vier Operationen, mockbares fetch, keine weiteren Abhängigkeiten.

export interface GraphMessage {
	id: string;
	internetMessageId: string;
	conversationId: string;
	subject: string;
	from: { name: string; address: string };
	toRecipients: string[];
	body: { contentType: 'html' | 'text'; content: string };
	receivedDateTime: string;
	hasAttachments: boolean;
}

export interface GraphAttachment {
	name: string;
	contentType: string;
	size: number;
	contentBytes: string; // base64
}

export interface OutgoingMail {
	subject: string;
	html: string;
	to: string[];
	attachments?: { name: string; contentType: string; contentBytes: string }[];
}

export interface GraphClient {
	deltaMessages(
		folder: 'inbox' | 'sentitems',
		deltaLink: string | null
	): Promise<{ messages: GraphMessage[]; deltaLink: string }>;
	getAttachments(messageId: string): Promise<GraphAttachment[]>;
	sendMail(mail: OutgoingMail): Promise<void>;
	moveToFolder(messageId: string, folderName: string): Promise<void>;
}

export interface GraphEnv {
	MS_TENANT_ID: string;
	MS_CLIENT_ID: string;
	MS_CLIENT_SECRET: string;
	SUPPORT_MAILBOX: string;
}

const GRAPH = 'https://graph.microsoft.com/v1.0';

const MESSAGE_SELECT =
	'$select=id,internetMessageId,conversationId,subject,from,toRecipients,body,receivedDateTime,hasAttachments';

export class GraphError extends Error {
	constructor(
		public status: number,
		message: string
	) {
		super(message);
	}
}

interface RawRecipient {
	emailAddress?: { name?: string; address?: string };
}

interface RawMessage {
	id: string;
	internetMessageId?: string;
	conversationId?: string;
	subject?: string;
	from?: RawRecipient;
	toRecipients?: RawRecipient[];
	body?: { contentType?: string; content?: string };
	receivedDateTime?: string;
	hasAttachments?: boolean;
	'@removed'?: unknown;
}

function toGraphMessage(raw: RawMessage): GraphMessage {
	return {
		id: raw.id,
		internetMessageId: raw.internetMessageId ?? '',
		conversationId: raw.conversationId ?? '',
		subject: raw.subject ?? '',
		from: {
			name: raw.from?.emailAddress?.name ?? '',
			address: raw.from?.emailAddress?.address ?? ''
		},
		toRecipients: (raw.toRecipients ?? [])
			.map((r) => r.emailAddress?.address ?? '')
			.filter(Boolean),
		body: {
			contentType: raw.body?.contentType === 'text' ? 'text' : 'html',
			content: raw.body?.content ?? ''
		},
		receivedDateTime: raw.receivedDateTime ?? '',
		hasAttachments: raw.hasAttachments ?? false
	};
}

export function createGraphClient(env: GraphEnv, fetchFn: typeof fetch = fetch): GraphClient {
	const mailbox = `${GRAPH}/users/${env.SUPPORT_MAILBOX}`;
	let token: { value: string; expiresAt: number } | null = null;
	const folderIds = new Map<string, string>();

	async function getToken(force = false): Promise<string> {
		if (!force && token && Date.now() < token.expiresAt) return token.value;
		const response = await fetchFn(
			`https://login.microsoftonline.com/${env.MS_TENANT_ID}/oauth2/v2.0/token`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body: new URLSearchParams({
					client_id: env.MS_CLIENT_ID,
					client_secret: env.MS_CLIENT_SECRET,
					grant_type: 'client_credentials',
					scope: 'https://graph.microsoft.com/.default'
				}).toString()
			}
		);
		if (!response.ok) throw new GraphError(response.status, 'Token-Abruf fehlgeschlagen');
		const data = (await response.json()) as { access_token: string; expires_in: number };
		// 5 Minuten Puffer vor Ablauf
		token = { value: data.access_token, expiresAt: Date.now() + (data.expires_in - 300) * 1000 };
		return token.value;
	}

	async function request(url: string, init: RequestInit = {}): Promise<Response> {
		const call = async (bearer: string) =>
			fetchFn(url, {
				...init,
				headers: {
					Authorization: `Bearer ${bearer}`,
					'Content-Type': 'application/json',
					...(init.headers ?? {})
				}
			});

		let response = await call(await getToken());
		if (response.status === 401) {
			response = await call(await getToken(true));
		}
		if (!response.ok) {
			throw new GraphError(response.status, `Graph-Aufruf fehlgeschlagen: ${url}`);
		}
		return response;
	}

	async function requestJson<T>(url: string, init: RequestInit = {}): Promise<T> {
		return (await request(url, init)).json() as Promise<T>;
	}

	async function folderId(name: string): Promise<string> {
		const cached = folderIds.get(name);
		if (cached) return cached;

		const search = await requestJson<{ value: { id: string; displayName: string }[] }>(
			`${mailbox}/mailFolders?$filter=displayName eq '${name.replace(/'/g, "''")}'`
		);
		let id = search.value.find((f) => f.displayName === name)?.id;
		if (!id) {
			const created = await requestJson<{ id: string }>(`${mailbox}/mailFolders`, {
				method: 'POST',
				body: JSON.stringify({ displayName: name })
			});
			id = created.id;
		}
		folderIds.set(name, id);
		return id;
	}

	return {
		async deltaMessages(folder, deltaLink) {
			const isInitialRun = deltaLink === null;
			let url = deltaLink ?? `${mailbox}/mailFolders/${folder}/messages/delta?${MESSAGE_SELECT}`;
			const messages: GraphMessage[] = [];

			for (;;) {
				const page = await requestJson<{
					value: RawMessage[];
					'@odata.nextLink'?: string;
					'@odata.deltaLink'?: string;
				}>(url);
				messages.push(...page.value.filter((m) => !m['@removed']).map(toGraphMessage));
				if (page['@odata.nextLink']) {
					url = page['@odata.nextLink'];
					continue;
				}
				// Erstlauf: nur den Delta-Link übernehmen, Altbestand nicht importieren
				return {
					messages: isInitialRun ? [] : messages,
					deltaLink: page['@odata.deltaLink'] ?? url
				};
			}
		},

		async getAttachments(messageId) {
			const data = await requestJson<{
				value: {
					'@odata.type': string;
					name: string;
					contentType?: string;
					size: number;
					contentBytes?: string;
				}[];
			}>(`${mailbox}/messages/${messageId}/attachments`);
			return data.value
				.filter((a) => a['@odata.type'] === '#microsoft.graph.fileAttachment' && a.contentBytes)
				.map((a) => ({
					name: a.name,
					contentType: a.contentType ?? 'application/octet-stream',
					size: a.size,
					contentBytes: a.contentBytes as string
				}));
		},

		async sendMail(mail) {
			await request(`${mailbox}/sendMail`, {
				method: 'POST',
				body: JSON.stringify({
					message: {
						subject: mail.subject,
						body: { contentType: 'HTML', content: mail.html },
						toRecipients: mail.to.map((address) => ({ emailAddress: { address } })),
						...(mail.attachments?.length
							? {
									attachments: mail.attachments.map((a) => ({
										'@odata.type': '#microsoft.graph.fileAttachment',
										name: a.name,
										contentType: a.contentType,
										contentBytes: a.contentBytes
									}))
								}
							: {})
					},
					saveToSentItems: true
				})
			});
		},

		async moveToFolder(messageId, folderName) {
			const destinationId = await folderId(folderName);
			await request(`${mailbox}/messages/${messageId}/move`, {
				method: 'POST',
				body: JSON.stringify({ destinationId })
			});
		}
	};
}
