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
import { contactSchema } from '$lib/validation/contact';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const company = await getCompany(db, params.id);
	if (!company) error(404, 'Firma nicht gefunden');
	return { company, contacts: await listContacts(db, params.id) };
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
	}
};
