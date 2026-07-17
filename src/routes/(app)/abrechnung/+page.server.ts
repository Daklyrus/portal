import { fail } from '@sveltejs/kit';
import { format, subMonths } from 'date-fns';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { buildBillingPreview, DEFAULT_HOURLY_RATE_CENTS } from '$lib/server/billing/preview';
import { BillingError, createBillingRun, discardBillingRun, listBillingRuns } from '$lib/server/billing/run';
import { createLexofficeClient } from '$lib/server/lexoffice/client';
import { getSetting, setSetting, SETTING_HOURLY_RATE } from '$lib/server/settings';
import { hourlyRateSchema } from '$lib/validation/billing';
import type { Actions, PageServerLoad } from './$types';

function resolveMonth(param: string | null): string {
	// Default: Vormonat — der ist typischerweise abzurechnen
	if (param && /^\d{4}-\d{2}$/.test(param)) return param;
	return format(subMonths(new Date(), 1), 'yyyy-MM');
}

export const load: PageServerLoad = async ({ url }) => {
	const month = resolveMonth(url.searchParams.get('monat'));
	return {
		month,
		previews: await buildBillingPreview(db, month),
		runs: await listBillingRuns(db, month),
		defaultRateCents: Number(
			(await getSetting(db, SETTING_HOURLY_RATE)) ?? DEFAULT_HOURLY_RATE_CENTS
		),
		hasLexofficeKey: Boolean(env.LEXOFFICE_API_KEY)
	};
};

export const actions: Actions = {
	setRate: async ({ request }) => {
		const parsed = hourlyRateSchema.safeParse(Object.fromEntries(await request.formData()));
		if (!parsed.success) return fail(400, { rateError: 'Stundensatz prüfen' });
		await setSetting(db, SETTING_HOURLY_RATE, String(parsed.data.hourlyRateCents));
		return { rateSaved: true };
	},

	createRun: async ({ request, locals }) => {
		const form = await request.formData();
		const companyId = String(form.get('companyId') ?? '');
		const month = resolveMonth(String(form.get('month') ?? ''));

		if (!env.LEXOFFICE_API_KEY) {
			return fail(400, {
				runError: 'lexoffice-API-Key fehlt (.env: LEXOFFICE_API_KEY).',
				runCompanyId: companyId
			});
		}

		try {
			await createBillingRun(
				db,
				createLexofficeClient(env.LEXOFFICE_API_KEY),
				companyId,
				month,
				locals.user?.id ?? null
			);
		} catch (error) {
			if (error instanceof BillingError) {
				return fail(400, { runError: error.message, runCompanyId: companyId });
			}
			throw error;
		}
		return { runCreated: true };
	},

	discardRun: async ({ request }) => {
		const form = await request.formData();
		await discardBillingRun(db, String(form.get('runId') ?? ''));
		return { runDiscarded: true };
	}
};
