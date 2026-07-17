// Pure Abbildung: Abrechnungs-Vorschau → lexoffice-Rechnungsentwurf.
// Cent → Euro passiert NUR hier, an der Grenze zu lexoffice.
import { addMonths, format, parseISO } from 'date-fns';
import type { BillingPreviewCompany } from './preview';

export interface LexofficeInvoiceDraft {
	voucherDate: string;
	address: { contactId: string };
	lineItems: {
		type: 'custom';
		name: string;
		description?: string;
		quantity: number;
		unitName: string;
		unitPrice: { currency: 'EUR'; netAmount: number; taxRatePercentage: 19 };
	}[];
	totalPrice: { currency: 'EUR' };
	taxConditions: { taxType: 'net' };
	title: string;
	introduction: string;
}

const MONTH_NAMES = [
	'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
	'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

function monthLabel(month: string): string {
	const [year, m] = month.split('-');
	return `${MONTH_NAMES[Number(m) - 1]} ${year}`;
}

export function buildInvoiceDraftPayload(
	preview: BillingPreviewCompany,
	month: string
): LexofficeInvoiceDraft {
	const monthStart = parseISO(`${month}-01`);
	const monthEnd = new Date(addMonths(monthStart, 1).getTime() - 86_400_000);
	const label = monthLabel(month);

	const lineItems: LexofficeInvoiceDraft['lineItems'] = preview.contracts.map(({ contract }) => ({
		type: 'custom',
		name: `${contract.title} — ${label}`,
		quantity: 1,
		unitName: 'Monat',
		unitPrice: {
			currency: 'EUR',
			netAmount: contract.monthlyFeeCents / 100,
			taxRatePercentage: 19
		}
	}));

	if (preview.totalMinutes > 0) {
		const proof = preview.timeEntries
			.map(
				(entry) =>
					`${format(parseISO(entry.workDate), 'dd.MM.')}: T-${entry.ticketNumber}` +
					`${entry.note ? ` ${entry.note}` : ` ${entry.ticketSubject}`} (${entry.minutes} min)`
			)
			.join('\n');

		lineItems.push({
			type: 'custom',
			name: `IT-Support nach Aufwand — ${label}`,
			description: proof,
			quantity: preview.hours,
			unitName: 'Stunde',
			unitPrice: {
				currency: 'EUR',
				netAmount: preview.hourlyRateCents / 100,
				taxRatePercentage: 19
			}
		});
	}

	return {
		voucherDate: `${format(monthEnd, 'yyyy-MM-dd')}T12:00:00.000+01:00`,
		address: { contactId: preview.company.lexofficeContactId ?? '' },
		lineItems,
		totalPrice: { currency: 'EUR' },
		taxConditions: { taxType: 'net' },
		title: 'Rechnung',
		introduction: `Leistungszeitraum ${format(monthStart, 'dd.MM.yyyy')} – ${format(monthEnd, 'dd.MM.yyyy')}`
	};
}
