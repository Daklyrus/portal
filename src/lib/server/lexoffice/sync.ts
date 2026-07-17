import { format, subMonths } from 'date-fns';
import { isNotNull } from 'drizzle-orm';
import type { db as defaultDb } from '../db';
import { companies, invoices } from '../db/schema';
import type { LexofficeClient } from './client';

type Db = typeof defaultDb;

/** Rechnungen der letzten 24 Monate für alle zugeordneten Firmen spiegeln */
export async function runInvoiceSyncOnce(
	db: Db,
	lex: LexofficeClient
): Promise<{ synced: number; errors: number }> {
	const mapped = await db
		.select({ id: companies.id, lexofficeContactId: companies.lexofficeContactId })
		.from(companies)
		.where(isNotNull(companies.lexofficeContactId));
	if (mapped.length === 0) return { synced: 0, errors: 0 };

	const byContact = new Map(mapped.map((c) => [c.lexofficeContactId as string, c.id]));
	const since = format(subMonths(new Date(), 24), 'yyyy-MM-dd');

	let synced = 0;
	let errors = 0;
	try {
		const list = await lex.listInvoices(since);
		for (const invoice of list) {
			const companyId = byContact.get(invoice.contactId);
			if (!companyId) continue;
			await db
				.insert(invoices)
				.values({
					companyId,
					lexofficeId: invoice.lexofficeId,
					voucherNumber: invoice.voucherNumber,
					voucherDate: invoice.voucherDate,
					dueDate: invoice.dueDate,
					totalCents: invoice.totalCents,
					status: invoice.status,
					updatedAt: new Date()
				})
				.onConflictDoUpdate({
					target: invoices.lexofficeId,
					set: {
						companyId,
						voucherNumber: invoice.voucherNumber,
						voucherDate: invoice.voucherDate,
						dueDate: invoice.dueDate,
						totalCents: invoice.totalCents,
						status: invoice.status,
						updatedAt: new Date()
					}
				});
			synced += 1;
		}
	} catch (error) {
		errors += 1;
		console.error('Rechnungs-Sync fehlgeschlagen:', error);
	}
	return { synced, errors };
}

/** Startet den stündlichen Rechnungs-Sync; gibt stop() zurück */
export function startInvoiceSync(db: Db, lex: LexofficeClient, intervalMs = 3_600_000): () => void {
	let busy = false;
	const tick = async () => {
		if (busy) return;
		busy = true;
		try {
			await runInvoiceSyncOnce(db, lex);
		} finally {
			busy = false;
		}
	};
	const timer = setInterval(() => void tick(), intervalMs);
	void tick();
	return () => clearInterval(timer);
}
