import {
	addDays,
	addMonths,
	differenceInCalendarDays,
	format,
	isBefore,
	parseISO,
	subDays,
	subMonths
} from 'date-fns';

export interface ContractTerms {
	/** ISO yyyy-MM-dd */
	startDate: string;
	initialTermMonths: number;
	/** 0 = Vertrag läuft aus statt sich zu verlängern */
	renewalTermMonths: number;
	noticePeriodMonths: number;
}

export interface ContractDeadlines {
	/** Letzter Tag der laufenden Vertragsperiode */
	currentPeriodEnd: string;
	/** Letzter Tag, an dem eine Kündigung fristgerecht eingehen darf */
	cancellationDeadline: string;
	/** Negativ = Frist verpasst, nächste Periode läuft bereits */
	daysUntilCancellationDeadline: number;
	autoRenews: boolean;
	/** Ausgelaufen: keine Verlängerung und Periodenende liegt in der Vergangenheit */
	hasEnded: boolean;
}

const ISO = 'yyyy-MM-dd';

export function computeContractDeadlines(terms: ContractTerms, today: Date): ContractDeadlines {
	const start = parseISO(terms.startDate);
	const autoRenews = terms.renewalTermMonths > 0;

	// Periodenende immer vom Startdatum aus rechnen, damit Monatsenden nicht driften
	let months = terms.initialTermMonths;
	let periodEnd = subDays(addMonths(start, months), 1);
	let hasEnded = false;

	while (isBefore(periodEnd, today)) {
		if (!autoRenews) {
			hasEnded = true;
			break;
		}
		months += terms.renewalTermMonths;
		periodEnd = subDays(addMonths(start, months), 1);
	}

	// Kündigung muss <noticePeriodMonths> vor Periodenende eingehen:
	// Deadline = Tag vor (Folgeperiodenbeginn - Kündigungsfrist)
	const cancellationDeadline = subDays(
		subMonths(addDays(periodEnd, 1), terms.noticePeriodMonths),
		1
	);

	return {
		currentPeriodEnd: format(periodEnd, ISO),
		cancellationDeadline: format(cancellationDeadline, ISO),
		daysUntilCancellationDeadline: differenceInCalendarDays(cancellationDeadline, today),
		autoRenews,
		hasEnded
	};
}
