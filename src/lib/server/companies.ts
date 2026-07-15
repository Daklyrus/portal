import { asc, eq, ilike, or } from 'drizzle-orm';
import type { db as defaultDb } from './db';
import { companies, type Company } from './db/schema';
import type { CompanyInput } from '$lib/validation/company';

type Db = typeof defaultDb;

export async function createCompany(db: Db, input: CompanyInput): Promise<Company> {
	const [created] = await db.insert(companies).values(input).returning();
	return created;
}

export async function getCompany(db: Db, id: string): Promise<Company | undefined> {
	const rows = await db.select().from(companies).where(eq(companies.id, id));
	return rows[0];
}

export async function updateCompany(db: Db, id: string, input: CompanyInput): Promise<void> {
	await db
		.update(companies)
		.set({ ...input, updatedAt: new Date() })
		.where(eq(companies.id, id));
}

export async function deleteCompany(db: Db, id: string): Promise<void> {
	await db.delete(companies).where(eq(companies.id, id));
}

export async function searchCompanies(db: Db, query: string): Promise<Company[]> {
	const trimmed = query.trim();
	const filter = trimmed
		? or(ilike(companies.name, `%${trimmed}%`), ilike(companies.customerNumber, `%${trimmed}%`))
		: undefined;
	return db.select().from(companies).where(filter).orderBy(asc(companies.name));
}
