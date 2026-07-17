// Lesezugriffe fürs Kundenportal — jede Query ist an die companyId gebunden.
import { and, asc, desc, eq, ne } from 'drizzle-orm';
import type { db as defaultDb } from '../db';
import {
	contracts,
	documents,
	invoices,
	type Contract,
	type Document,
	type Invoice
} from '../db/schema';

type Db = typeof defaultDb;

export async function listPortalInvoices(db: Db, companyId: string): Promise<Invoice[]> {
	return db
		.select()
		.from(invoices)
		.where(and(eq(invoices.companyId, companyId), ne(invoices.status, 'voided')))
		.orderBy(desc(invoices.voucherDate));
}

export async function getPortalInvoice(
	db: Db,
	companyId: string,
	invoiceId: string
): Promise<Invoice | undefined> {
	const rows = await db
		.select()
		.from(invoices)
		.where(and(eq(invoices.id, invoiceId), eq(invoices.companyId, companyId)));
	return rows[0];
}

export async function listSharedContracts(db: Db, companyId: string): Promise<Contract[]> {
	return db
		.select()
		.from(contracts)
		.where(and(eq(contracts.companyId, companyId), eq(contracts.sharedWithCustomer, true)))
		.orderBy(asc(contracts.startDate));
}

export async function listSharedDocuments(db: Db, companyId: string): Promise<Document[]> {
	return db
		.select()
		.from(documents)
		.where(and(eq(documents.companyId, companyId), eq(documents.sharedWithCustomer, true)))
		.orderBy(desc(documents.createdAt));
}

export async function getSharedDocument(
	db: Db,
	companyId: string,
	documentId: string
): Promise<Document | undefined> {
	const rows = await db
		.select()
		.from(documents)
		.where(
			and(
				eq(documents.id, documentId),
				eq(documents.companyId, companyId),
				eq(documents.sharedWithCustomer, true)
			)
		);
	return rows[0];
}
