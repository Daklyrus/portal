import { desc, eq } from 'drizzle-orm';
import type { db as defaultDb } from '../db';
import { documents, type Document, type NewDocument } from '../db/schema';

type Db = typeof defaultDb;

export async function createDocument(db: Db, input: NewDocument): Promise<Document> {
	const [created] = await db.insert(documents).values(input).returning();
	return created;
}

export async function getDocument(db: Db, id: string): Promise<Document | undefined> {
	const rows = await db.select().from(documents).where(eq(documents.id, id));
	return rows[0];
}

export async function deleteDocument(db: Db, id: string): Promise<void> {
	await db.delete(documents).where(eq(documents.id, id));
}

export async function listDocuments(db: Db, companyId: string): Promise<Document[]> {
	return db
		.select()
		.from(documents)
		.where(eq(documents.companyId, companyId))
		.orderBy(desc(documents.createdAt));
}
