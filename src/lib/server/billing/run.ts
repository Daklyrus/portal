import { asc, desc, eq, inArray } from 'drizzle-orm';
import type { db as defaultDb } from '../db';
import { billingRuns, companies, timeEntries, type BillingRun } from '../db/schema';
import type { LexofficeClient } from '../lexoffice/client';
import { buildInvoiceDraftPayload } from './draft';
import { buildBillingPreview } from './preview';

type Db = typeof defaultDb;

export class BillingError extends Error {}

/** Entwurf in lexoffice erzeugen, Lauf speichern, enthaltene Zeiten sperren */
export async function createBillingRun(
	db: Db,
	lex: LexofficeClient,
	companyId: string,
	month: string,
	userId: string | null
): Promise<BillingRun> {
	// Vorschau frisch berechnen — nie mit veralteten Client-Daten abrechnen
	const previews = await buildBillingPreview(db, month);
	const preview = previews.find((p) => p.company.id === companyId);

	if (!preview) throw new BillingError('Für diese Firma gibt es in dem Monat nichts abzurechnen.');
	if (preview.alreadyBilled) {
		throw new BillingError('Für diesen Monat existiert bereits ein Abrechnungslauf.');
	}
	if (preview.missingLexofficeId) {
		throw new BillingError('Der Firma fehlt die lexoffice-Kontakt-ID (in der Akte pflegen).');
	}
	if (preview.totalNetCents <= 0) {
		throw new BillingError('Der Entwurf hätte keine Summe — nichts zu erzeugen.');
	}

	const { id: lexofficeInvoiceId } = await lex.createInvoiceDraft(
		buildInvoiceDraftPayload(preview, month)
	);

	const [run] = await db
		.insert(billingRuns)
		.values({
			companyId,
			month,
			lexofficeInvoiceId,
			totalNetCents: preview.totalNetCents,
			createdById: userId
		})
		.returning();

	const entryIds = preview.timeEntries.map((entry) => entry.id);
	if (entryIds.length > 0) {
		await db
			.update(timeEntries)
			.set({ billingRunId: run.id })
			.where(inArray(timeEntries.id, entryIds));
	}

	return run;
}

/** Lauf löschen — SET NULL gibt die Zeiten automatisch wieder frei */
export async function discardBillingRun(db: Db, runId: string): Promise<void> {
	await db.delete(billingRuns).where(eq(billingRuns.id, runId));
}

export async function listBillingRuns(
	db: Db,
	month?: string
): Promise<(BillingRun & { companyName: string })[]> {
	const rows = await db
		.select({ run: billingRuns, companyName: companies.name })
		.from(billingRuns)
		.innerJoin(companies, eq(billingRuns.companyId, companies.id))
		.where(month ? eq(billingRuns.month, month) : undefined)
		.orderBy(desc(billingRuns.createdAt), asc(companies.name));
	return rows.map(({ run, companyName }) => ({ ...run, companyName }));
}
