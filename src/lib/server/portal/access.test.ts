import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { createAuth } from '../auth';
import {
	activatePortalAccess,
	deactivatePortalAccess,
	getPortalContext,
	PortalError
} from './access';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL ist nicht gesetzt');

const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema });

let resetMails: { email: string; link: string }[] = [];

const authInstance = createAuth(db, {
	requestCookies: false,
	allowSignUp: true,
	onResetPassword: async ({ user, link }) => {
		resetMails.push({ email: user.email, link });
	}
});

let companyId: string;
let contactId: string;

beforeEach(async () => {
	resetMails = [];
	await db.delete(schema.companies);
	await db.delete(schema.user);
	const [company] = await db.insert(schema.companies).values({ name: 'Portal GmbH' }).returning();
	companyId = company.id;
	const [contact] = await db
		.insert(schema.contacts)
		.values({ companyId, firstName: 'Petra', lastName: 'Portal', email: 'petra@portal-gmbh.de' })
		.returning();
	contactId = contact.id;
});

afterAll(async () => {
	await client.end();
});

describe('activatePortalAccess', () => {
	it('legt customer-nutzer und zugang an und verschickt den einladungs-link', async () => {
		const access = await activatePortalAccess(db, authInstance, contactId);

		expect(access.companyId).toBe(companyId);
		const [portalUser] = await db
			.select()
			.from(schema.user)
			.where(eq(schema.user.email, 'petra@portal-gmbh.de'));
		expect(portalUser.role).toBe('customer');

		expect(resetMails).toHaveLength(1);
		expect(resetMails[0].email).toBe('petra@portal-gmbh.de');
		expect(resetMails[0].link).toContain('/passwort?token=');
	});

	it('lehnt kontakte ohne e-mail ab', async () => {
		const [ohneMail] = await db
			.insert(schema.contacts)
			.values({ companyId, firstName: 'Ohne', lastName: 'Mail' })
			.returning();
		await expect(activatePortalAccess(db, authInstance, ohneMail.id)).rejects.toThrow(PortalError);
	});

	it('lehnt doppelte aktivierung ab', async () => {
		await activatePortalAccess(db, authInstance, contactId);
		await expect(activatePortalAccess(db, authInstance, contactId)).rejects.toThrow(
			'Zugang existiert bereits'
		);
	});

	it('lehnt e-mails ab, für die schon ein konto existiert', async () => {
		await db
			.insert(schema.user)
			.values({ id: 'intern-1', name: 'Intern', email: 'petra@portal-gmbh.de', emailVerified: true });
		await expect(activatePortalAccess(db, authInstance, contactId)).rejects.toThrow(PortalError);
	});
});

describe('deactivatePortalAccess / getPortalContext', () => {
	it('liefert den firmen-kontext und räumt bei deaktivierung auf', async () => {
		const access = await activatePortalAccess(db, authInstance, contactId);

		const ctx = await getPortalContext(db, access.userId);
		expect(ctx).toEqual({ userId: access.userId, contactId, companyId });

		await deactivatePortalAccess(db, contactId);
		expect(await getPortalContext(db, access.userId)).toBeUndefined();
		expect(await db.select().from(schema.user)).toHaveLength(0);
	});
});
