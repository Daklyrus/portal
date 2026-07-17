import { describe, it, expect } from 'vitest';
import { buildInvoiceDraftPayload } from './draft';
import type { BillingPreviewCompany } from './preview';

const company = {
	id: 'firma-1',
	name: 'Alpha GmbH',
	lexofficeContactId: 'lex-kontakt-1',
	hourlyRateCents: null
} as BillingPreviewCompany['company'];

const contract = {
	id: 'vertrag-1',
	title: 'Managed Basic',
	monthlyFeeCents: 49900
} as BillingPreviewCompany['contracts'][number]['contract'];

function preview(overrides: Partial<BillingPreviewCompany> = {}): BillingPreviewCompany {
	return {
		company,
		contracts: [{ contract, note: null }],
		timeEntries: [
			{ id: 't1', workDate: '2026-06-03', ticketNumber: 1042, ticketSubject: 'Drucker', note: 'Fernwartung', minutes: 120 },
			{ id: 't2', workDate: '2026-06-17', ticketNumber: 1043, ticketSubject: 'VPN', note: null, minutes: 127 }
		],
		totalMinutes: 247,
		hours: 4.12,
		hourlyRateCents: 9500,
		laborNetCents: 39140,
		flatFeesNetCents: 49900,
		totalNetCents: 89040,
		missingLexofficeId: false,
		alreadyBilled: false,
		...overrides
	};
}

describe('buildInvoiceDraftPayload', () => {
	it('baut pauschal- und aufwandsposition mit netto-19 und deutschem monat', () => {
		const draft = buildInvoiceDraftPayload(preview(), '2026-06');

		expect(draft.address).toEqual({ contactId: 'lex-kontakt-1' });
		expect(draft.taxConditions).toEqual({ taxType: 'net' });
		expect(draft.voucherDate.startsWith('2026-06-30')).toBe(true);
		expect(draft.introduction).toBe('Leistungszeitraum 01.06.2026 – 30.06.2026');

		expect(draft.lineItems).toHaveLength(2);
		const [flat, labor] = draft.lineItems;
		expect(flat.name).toBe('Managed Basic — Juni 2026');
		expect(flat.quantity).toBe(1);
		expect(flat.unitName).toBe('Monat');
		expect(flat.unitPrice).toEqual({ currency: 'EUR', netAmount: 499, taxRatePercentage: 19 });

		expect(labor.name).toBe('IT-Support nach Aufwand — Juni 2026');
		expect(labor.quantity).toBe(4.12);
		expect(labor.unitName).toBe('Stunde');
		expect(labor.unitPrice).toEqual({ currency: 'EUR', netAmount: 95, taxRatePercentage: 19 });
		expect(labor.description).toContain('03.06.: T-1042 Fernwartung (120 min)');
		expect(labor.description).toContain('17.06.: T-1043 VPN (127 min)');
	});

	it('lässt die aufwandsposition ohne zeiten weg', () => {
		const draft = buildInvoiceDraftPayload(
			preview({ timeEntries: [], totalMinutes: 0, hours: 0, laborNetCents: 0 }),
			'2026-06'
		);
		expect(draft.lineItems).toHaveLength(1);
		expect(draft.lineItems[0].unitName).toBe('Monat');
	});
});
