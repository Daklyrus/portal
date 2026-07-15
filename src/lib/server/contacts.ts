import { and, asc, eq } from 'drizzle-orm';
import type { db as defaultDb } from './db';
import { contacts, type Contact } from './db/schema';
import type { ContactInput } from '$lib/validation/contact';

type Db = typeof defaultDb;

export async function createContact(db: Db, companyId: string, input: ContactInput): Promise<Contact> {
	const [created] = await db.insert(contacts).values({ ...input, companyId }).returning();
	return created;
}

export async function updateContact(db: Db, id: string, input: ContactInput): Promise<void> {
	await db
		.update(contacts)
		.set({ ...input, updatedAt: new Date() })
		.where(eq(contacts.id, id));
}

export async function deleteContact(db: Db, id: string): Promise<void> {
	await db.delete(contacts).where(eq(contacts.id, id));
}

export async function listContacts(db: Db, companyId: string): Promise<Contact[]> {
	return db
		.select()
		.from(contacts)
		.where(eq(contacts.companyId, companyId))
		.orderBy(asc(contacts.lastName), asc(contacts.firstName));
}

/** Genau ein Hauptkontakt je Firma — alle anderen werden zurückgesetzt */
export async function setPrimaryContact(db: Db, companyId: string, contactId: string): Promise<void> {
	await db.transaction(async (tx) => {
		await tx.update(contacts).set({ isPrimary: false }).where(eq(contacts.companyId, companyId));
		await tx
			.update(contacts)
			.set({ isPrimary: true })
			.where(and(eq(contacts.companyId, companyId), eq(contacts.id, contactId)));
	});
}
