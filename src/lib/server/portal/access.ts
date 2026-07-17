import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import type { createAuth, auth as defaultAuth } from '../auth';
import type { db as defaultDb } from '../db';
import { contacts, portalAccess, user, type PortalAccess } from '../db/schema';

type Db = typeof defaultDb;
type AuthInstance = ReturnType<typeof createAuth> | typeof defaultAuth;

export class PortalError extends Error {}

export interface PortalContext {
	userId: string;
	contactId: string;
	companyId: string;
}

/**
 * Legt für einen Ansprechpartner einen Portal-Login an (Rolle customer,
 * Zufallspasswort) und verschickt den Passwort-Link. Die übergebene
 * Auth-Instanz muss signUp erlauben (createAuth mit allowSignUp: true).
 */
export async function activatePortalAccess(
	db: Db,
	authInstance: AuthInstance,
	contactId: string
): Promise<PortalAccess> {
	const contactRows = await db.select().from(contacts).where(eq(contacts.id, contactId));
	const contact = contactRows[0];
	if (!contact) throw new PortalError('Kontakt nicht gefunden.');
	if (!contact.email) throw new PortalError('Kontakt braucht eine E-Mail-Adresse.');

	const existing = await db
		.select()
		.from(portalAccess)
		.where(eq(portalAccess.contactId, contactId));
	if (existing.length > 0) throw new PortalError('Zugang existiert bereits.');

	const email = contact.email.toLowerCase();
	try {
		await authInstance.api.signUpEmail({
			body: {
				email,
				password: `${randomUUID()}${randomUUID()}`,
				name: `${contact.firstName} ${contact.lastName}`
			}
		});
	} catch {
		throw new PortalError('Für diese E-Mail-Adresse existiert bereits ein Konto.');
	}

	const userRows = await db.select().from(user).where(eq(user.email, email));
	const created = userRows[0];
	if (!created) throw new PortalError('Nutzer konnte nicht angelegt werden.');

	await db.update(user).set({ role: 'customer' }).where(eq(user.id, created.id));
	const [access] = await db
		.insert(portalAccess)
		.values({ userId: created.id, contactId, companyId: contact.companyId })
		.returning();

	await authInstance.api.requestPasswordReset({ body: { email, redirectTo: '/passwort' } });

	return access;
}

/** Entfernt Portal-Login samt Sessions (Cascade über den Nutzer) */
export async function deactivatePortalAccess(db: Db, contactId: string): Promise<void> {
	const rows = await db.select().from(portalAccess).where(eq(portalAccess.contactId, contactId));
	const access = rows[0];
	if (!access) return;
	await db.delete(user).where(eq(user.id, access.userId));
}

export async function getPortalContext(db: Db, userId: string): Promise<PortalContext | undefined> {
	const rows = await db.select().from(portalAccess).where(eq(portalAccess.userId, userId));
	const access = rows[0];
	if (!access) return undefined;
	return { userId: access.userId, contactId: access.contactId, companyId: access.companyId };
}

/** Zugänge zu einer Kontaktliste (für die Kundenakte) */
export async function getPortalAccessByContact(
	db: Db,
	contactIds: string[]
): Promise<Map<string, PortalAccess>> {
	if (contactIds.length === 0) return new Map();
	const rows = await db
		.select()
		.from(portalAccess)
		.where(inArray(portalAccess.contactId, contactIds));
	return new Map(rows.map((row) => [row.contactId, row]));
}
