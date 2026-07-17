// Schlanker Client für die lexoffice Public API v1 (nur Lesezugriffe).
// Rechnungserzeugung bleibt bewusst in lexoffice (GoBD) — hier nur Spiegel-Daten.

import type { InvoiceStatus } from '../db/schema';

export interface LexofficeInvoice {
	lexofficeId: string;
	voucherNumber: string;
	voucherDate: string; // yyyy-MM-dd
	dueDate: string | null;
	totalCents: number;
	status: InvoiceStatus;
	contactId: string;
}

export interface LexofficeClient {
	/** Festgeschriebene Rechnungen ab Datum (alle Seiten) */
	listInvoices(sinceIso: string): Promise<LexofficeInvoice[]>;
	getInvoicePdf(lexofficeId: string): Promise<{ data: ArrayBuffer; fileName: string }>;
	/** Rechnungs-ENTWURF anlegen (kein finalize — Festschreiben bleibt in lexoffice) */
	createInvoiceDraft(draft: import('../billing/draft').LexofficeInvoiceDraft): Promise<{ id: string }>;
}

const BASE = 'https://api.lexoffice.io/v1';

export class LexofficeError extends Error {
	constructor(
		public status: number,
		message: string
	) {
		super(message);
	}
}

interface RawVoucher {
	id: string;
	voucherType: string;
	voucherStatus: string;
	voucherNumber: string;
	voucherDate: string;
	dueDate?: string | null;
	totalAmount: number;
	contactId?: string;
}

function normalizeStatus(raw: string): InvoiceStatus {
	if (raw === 'paid' || raw === 'paidoff') return 'paid';
	if (raw === 'overdue') return 'overdue';
	if (raw === 'voided') return 'voided';
	return 'open';
}

const isoDay = (value: string | null | undefined) => (value ? value.slice(0, 10) : null);

export function createLexofficeClient(apiKey: string, fetchFn: typeof fetch = fetch): LexofficeClient {
	async function request(path: string, init: RequestInit = {}): Promise<Response> {
		const response = await fetchFn(`${BASE}${path}`, {
			...init,
			headers: {
				Authorization: `Bearer ${apiKey}`,
				Accept: 'application/json',
				...(init.body ? { 'Content-Type': 'application/json' } : {}),
				...(init.headers ?? {})
			}
		});
		if (!response.ok) {
			throw new LexofficeError(response.status, `lexoffice-Aufruf fehlgeschlagen: ${path}`);
		}
		return response;
	}

	return {
		async listInvoices(sinceIso) {
			const invoices: LexofficeInvoice[] = [];
			for (let page = 0; ; page++) {
				const response = await request(
					`/voucherlist?voucherType=invoice&voucherStatus=open,paid,paidoff,overdue,voided` +
						`&voucherDateFrom=${sinceIso}&size=250&sort=voucherDate,DESC&page=${page}`
				);
				const data = (await response.json()) as { content: RawVoucher[]; last: boolean };
				invoices.push(
					...data.content
						.filter((v) => v.voucherType === 'invoice' && v.contactId)
						.map((v) => ({
							lexofficeId: v.id,
							voucherNumber: v.voucherNumber,
							voucherDate: isoDay(v.voucherDate) ?? '',
							dueDate: isoDay(v.dueDate),
							totalCents: Math.round(v.totalAmount * 100),
							status: normalizeStatus(v.voucherStatus),
							contactId: v.contactId as string
						}))
				);
				if (data.last) return invoices;
			}
		},

		async createInvoiceDraft(draft) {
			const response = await request('/invoices', {
				method: 'POST',
				body: JSON.stringify(draft)
			});
			const data = (await response.json()) as { id: string };
			return { id: data.id };
		},

		async getInvoicePdf(lexofficeId) {
			const documentResponse = await request(`/invoices/${lexofficeId}/document`);
			const { documentFileId } = (await documentResponse.json()) as { documentFileId: string };

			const fileResponse = await request(`/files/${documentFileId}`);
			const disposition = fileResponse.headers.get('Content-Disposition') ?? '';
			const match = disposition.match(/filename="?([^";]+)"?/);
			return {
				data: await fileResponse.arrayBuffer(),
				fileName: match?.[1] ?? `rechnung-${lexofficeId}.pdf`
			};
		}
	};
}
