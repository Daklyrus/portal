import { addMonths, format, parseISO } from 'date-fns';
import { and, asc, eq, gte, isNull, lt, lte } from 'drizzle-orm';
import type { db as defaultDb } from '../db';
import {
	billingRuns,
	companies,
	contracts,
	tickets,
	timeEntries,
	type Company,
	type Contract
} from '../db/schema';
import { getSetting, SETTING_HOURLY_RATE } from '../settings';

type Db = typeof defaultDb;

/** Fallback, solange kein Standard-Stundensatz gepflegt ist (95 € netto) */
export const DEFAULT_HOURLY_RATE_CENTS = 9500;

export interface TimeEntryForBilling {
	id: string;
	workDate: string;
	ticketNumber: number;
	ticketSubject: string;
	note: string | null;
	minutes: number;
}

export interface BillingPreviewCompany {
	company: Company;
	contracts: { contract: Contract; note: string | null }[];
	timeEntries: TimeEntryForBilling[];
	totalMinutes: number;
	hours: number;
	hourlyRateCents: number;
	laborNetCents: number;
	flatFeesNetCents: number;
	totalNetCents: number;
	missingLexofficeId: boolean;
	alreadyBilled: boolean;
}

/** Abrechnungs-Vorschau je Firma für einen Monat ('yyyy-MM') */
export async function buildBillingPreview(db: Db, month: string): Promise<BillingPreviewCompany[]> {
	const monthStart = `${month}-01`;
	const nextMonthStart = format(addMonths(parseISO(monthStart), 1), 'yyyy-MM-dd');
	const monthEnd = format(addMonths(parseISO(monthStart), 1).getTime() - 86_400_000, 'yyyy-MM-dd');

	const defaultRate = Number(
		(await getSetting(db, SETTING_HOURLY_RATE)) ?? DEFAULT_HOURLY_RATE_CENTS
	);

	// Aktive Pauschal-Verträge, die im Monat schon laufen
	const contractRows = await db
		.select()
		.from(contracts)
		.where(and(eq(contracts.status, 'active'), lte(contracts.startDate, monthEnd)))
		.orderBy(asc(contracts.startDate));

	// Offene abrechenbare Zeiten des Monats
	const timeRows = await db
		.select({
			id: timeEntries.id,
			workDate: timeEntries.workDate,
			minutes: timeEntries.minutes,
			note: timeEntries.note,
			companyId: tickets.companyId,
			ticketNumber: tickets.number,
			ticketSubject: tickets.subject
		})
		.from(timeEntries)
		.innerJoin(tickets, eq(timeEntries.ticketId, tickets.id))
		.where(
			and(
				eq(timeEntries.billable, true),
				isNull(timeEntries.billingRunId),
				gte(timeEntries.workDate, monthStart),
				lt(timeEntries.workDate, nextMonthStart)
			)
		)
		.orderBy(asc(timeEntries.workDate));

	const existingRuns = await db
		.select({ companyId: billingRuns.companyId })
		.from(billingRuns)
		.where(eq(billingRuns.month, month));
	const billedCompanyIds = new Set(existingRuns.map((r) => r.companyId));

	const companyIds = new Set<string>();
	for (const contract of contractRows) {
		if (contract.monthlyFeeCents > 0) companyIds.add(contract.companyId);
	}
	for (const entry of timeRows) {
		if (entry.companyId) companyIds.add(entry.companyId);
	}
	if (companyIds.size === 0) return [];

	const companyRows = await db.select().from(companies).orderBy(asc(companies.name));

	return companyRows
		.filter((company) => companyIds.has(company.id))
		.map((company) => {
			const companyContracts = contractRows
				.filter((c) => c.companyId === company.id && c.monthlyFeeCents > 0)
				.map((contract) => ({
					contract,
					note:
						contract.startDate >= monthStart
							? `Vertragsbeginn am ${format(parseISO(contract.startDate), 'dd.MM.yyyy')} im Abrechnungsmonat — volle Pauschale, bei Bedarf im Entwurf anpassen`
							: null
				}));

			const companyTimes: TimeEntryForBilling[] = timeRows
				.filter((entry) => entry.companyId === company.id)
				.map(({ companyId: _companyId, ...entry }) => entry);

			const totalMinutes = companyTimes.reduce((sum, entry) => sum + entry.minutes, 0);
			const hours = Math.round((totalMinutes / 60) * 100) / 100;
			const hourlyRateCents = company.hourlyRateCents ?? defaultRate;
			const laborNetCents = Math.round(hours * hourlyRateCents);
			const flatFeesNetCents = companyContracts.reduce(
				(sum, { contract }) => sum + contract.monthlyFeeCents,
				0
			);

			return {
				company,
				contracts: companyContracts,
				timeEntries: companyTimes,
				totalMinutes,
				hours,
				hourlyRateCents,
				laborNetCents,
				flatFeesNetCents,
				totalNetCents: flatFeesNetCents + laborNetCents,
				missingLexofficeId: !company.lexofficeContactId,
				alreadyBilled: billedCompanyIds.has(company.id)
			};
		});
}
