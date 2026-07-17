import { error, fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { deleteCompany, getCompany } from '$lib/server/companies';
import {
	createContact,
	deleteContact,
	listContacts,
	setPrimaryContact,
	updateContact
} from '$lib/server/contacts';
import {
	createContract,
	deleteContract,
	listContractsWithDeadlines,
	markContractCancelled,
	updateContract
} from '$lib/server/contracts';
import {
	createDocument,
	deleteDocument,
	getDocument,
	listDocuments
} from '$lib/server/documents/documents';
import { createAuth } from '$lib/server/auth';
import {
	activatePortalAccess,
	deactivatePortalAccess,
	getPortalAccessByContact,
	PortalError
} from '$lib/server/portal/access';
import { deleteStoredFile, saveUpload, UploadError } from '$lib/server/documents/storage';
import { contactSchema } from '$lib/validation/contact';
import { contractSchema } from '$lib/validation/contract';
import type { Actions, PageServerLoad } from './$types';

// Eigene Instanz mit signUp-Erlaubnis — nur serverseitig für die Zugangs-Anlage genutzt
const portalAuth = createAuth(db, { allowSignUp: true });

export const load: PageServerLoad = async ({ params }) => {
	const company = await getCompany(db, params.id);
	if (!company) error(404, 'Firma nicht gefunden');
	const contacts = await listContacts(db, params.id);
	const accessMap = await getPortalAccessByContact(
		db,
		contacts.map((c) => c.id)
	);
	return {
		company,
		contacts,
		portalContactIds: [...accessMap.keys()],
		contracts: await listContractsWithDeadlines(db, params.id, new Date()),
		documents: await listDocuments(db, params.id)
	};
};

export const actions: Actions = {
	delete: async ({ params }) => {
		await deleteCompany(db, params.id);
		redirect(303, '/firmen');
	},

	createContact: async ({ params, request }) => {
		const raw = Object.fromEntries(await request.formData());
		const parsed = contactSchema.safeParse(raw);
		if (!parsed.success) {
			return fail(400, {
				contactErrors: parsed.error.flatten().fieldErrors,
				contactValues: raw,
				editing: 'new'
			});
		}
		await createContact(db, params.id, parsed.data);
		return { contactSaved: true };
	},

	updateContact: async ({ params, request }) => {
		const form = await request.formData();
		const contactId = String(form.get('contactId') ?? '');
		const raw = Object.fromEntries(form);
		const parsed = contactSchema.safeParse(raw);
		if (!parsed.success) {
			return fail(400, {
				contactErrors: parsed.error.flatten().fieldErrors,
				contactValues: raw,
				editing: contactId
			});
		}
		await updateContact(db, contactId, parsed.data);
		return { contactSaved: true };
	},

	deleteContact: async ({ request }) => {
		const form = await request.formData();
		await deleteContact(db, String(form.get('contactId') ?? ''));
		return { contactSaved: true };
	},

	setPrimary: async ({ params, request }) => {
		const form = await request.formData();
		await setPrimaryContact(db, params.id, String(form.get('contactId') ?? ''));
		return { contactSaved: true };
	},

	activatePortal: async ({ request }) => {
		const form = await request.formData();
		const contactId = String(form.get('contactId') ?? '');
		try {
			await activatePortalAccess(db, portalAuth, contactId);
		} catch (err) {
			if (err instanceof PortalError) {
				return fail(400, { portalError: err.message, portalContactId: contactId });
			}
			throw err;
		}
		return { contactSaved: true };
	},

	deactivatePortal: async ({ request }) => {
		const form = await request.formData();
		await deactivatePortalAccess(db, String(form.get('contactId') ?? ''));
		return { contactSaved: true };
	},

	createContract: async ({ params, request }) => {
		const raw = Object.fromEntries(await request.formData());
		const parsed = contractSchema.safeParse(raw);
		if (!parsed.success) {
			return fail(400, {
				contractErrors: parsed.error.flatten().fieldErrors,
				contractValues: raw,
				editingContract: 'new'
			});
		}
		await createContract(db, params.id, parsed.data);
		return { contractSaved: true };
	},

	updateContract: async ({ request }) => {
		const form = await request.formData();
		const contractId = String(form.get('contractId') ?? '');
		const raw = Object.fromEntries(form);
		const parsed = contractSchema.safeParse(raw);
		if (!parsed.success) {
			return fail(400, {
				contractErrors: parsed.error.flatten().fieldErrors,
				contractValues: raw,
				editingContract: contractId
			});
		}
		await updateContract(db, contractId, parsed.data);
		return { contractSaved: true };
	},

	cancelContract: async ({ request }) => {
		const form = await request.formData();
		const today = new Date().toISOString().slice(0, 10);
		await markContractCancelled(db, String(form.get('contractId') ?? ''), today);
		return { contractSaved: true };
	},

	deleteContract: async ({ request }) => {
		const form = await request.formData();
		await deleteContract(db, String(form.get('contractId') ?? ''));
		return { contractSaved: true };
	},

	uploadDocument: async ({ params, request, locals }) => {
		const form = await request.formData();
		const file = form.get('file');
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { documentError: 'Datei auswählen.' });
		}
		try {
			const stored = await saveUpload(file, params.id);
			await createDocument(db, {
				companyId: params.id,
				fileName: file.name,
				storagePath: stored.storagePath,
				mimeType: stored.mimeType,
				sizeBytes: stored.sizeBytes,
				sharedWithCustomer: form.get('sharedWithCustomer') === 'on',
				uploadedById: locals.user?.id ?? null
			});
		} catch (err) {
			if (err instanceof UploadError) return fail(400, { documentError: err.message });
			throw err;
		}
		return { documentSaved: true };
	},

	deleteDocument: async ({ request }) => {
		const form = await request.formData();
		const document = await getDocument(db, String(form.get('documentId') ?? ''));
		if (document) {
			await deleteDocument(db, document.id);
			await deleteStoredFile(document.storagePath);
		}
		return { documentSaved: true };
	}
};
