import { addDays, addMinutes, format } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import type { TicketPriority, TicketStatus } from '$lib/server/db/schema';

/** Reaktionszeit in Geschäftsminuten je Priorität (abgestimmt am 16.07.2026) */
export const SLA_RESPONSE_MINUTES: Record<TicketPriority, number> = {
	critical: 120,
	high: 240,
	normal: 480
};

const TZ = 'Europe/Berlin';
const WORK_START_HOUR = 8;
const WORK_END_HOUR = 17;

/** Gaußsche Osterformel: Ostersonntag als Monat (1-basiert) und Tag */
function easterSunday(year: number): { month: number; day: number } {
	const a = year % 19;
	const b = year % 4;
	const c = year % 7;
	const k = Math.floor(year / 100);
	const p = Math.floor((13 + 8 * k) / 25);
	const q = Math.floor(k / 4);
	const m = (15 - p + k - q) % 30;
	const n = (4 + k - q) % 7;
	const d = (19 * a + m) % 30;
	const e = (2 * b + 4 * c + 6 * d + n) % 7;
	let offset = 22 + d + e; // Tag im März
	if (d === 29 && e === 6) offset = 50;
	if (d === 28 && e === 6 && (11 * m + 11) % 30 < 19) offset = 49;
	return offset <= 31 ? { month: 3, day: offset } : { month: 4, day: offset - 31 };
}

/** Gesetzliche Feiertage in NRW als ISO-Daten */
export function nrwHolidays(year: number): string[] {
	const easter = easterSunday(year);
	// Lokale Mitternacht reicht — wir brauchen nur das Kalenderdatum
	const easterDate = new Date(year, easter.month - 1, easter.day);
	const iso = (d: Date) => format(d, 'yyyy-MM-dd');
	return [
		`${year}-01-01`, // Neujahr
		iso(addDays(easterDate, -2)), // Karfreitag
		iso(addDays(easterDate, 1)), // Ostermontag
		`${year}-05-01`, // Tag der Arbeit
		iso(addDays(easterDate, 39)), // Christi Himmelfahrt
		iso(addDays(easterDate, 50)), // Pfingstmontag
		iso(addDays(easterDate, 60)), // Fronleichnam
		`${year}-10-03`, // Tag der Deutschen Einheit
		`${year}-11-01`, // Allerheiligen
		`${year}-12-25`,
		`${year}-12-26`
	];
}

function isWorkday(zoned: Date): boolean {
	const weekday = zoned.getDay();
	if (weekday === 0 || weekday === 6) return false;
	return !nrwHolidays(zoned.getFullYear()).includes(format(zoned, 'yyyy-MM-dd'));
}

function atHour(zoned: Date, hour: number): Date {
	const copy = new Date(zoned);
	copy.setHours(hour, 0, 0, 0);
	return copy;
}

/** Fälligkeit der ersten Reaktion: addiert Geschäftsminuten (Mo–Fr 08–17 Uhr Europe/Berlin, NRW-Feiertage frei) */
export function computeSlaDueAt(createdAt: Date, priority: TicketPriority): Date {
	let remaining = SLA_RESPONSE_MINUTES[priority];
	// Wall-Clock-Arithmetik in Berlin-Zeit, am Ende zurück nach UTC
	let cursor = toZonedTime(createdAt, TZ);

	for (;;) {
		if (!isWorkday(cursor)) {
			cursor = atHour(addDays(cursor, 1), WORK_START_HOUR);
			continue;
		}
		if (cursor < atHour(cursor, WORK_START_HOUR)) {
			cursor = atHour(cursor, WORK_START_HOUR);
			continue;
		}
		const dayEnd = atHour(cursor, WORK_END_HOUR);
		if (cursor >= dayEnd) {
			cursor = atHour(addDays(cursor, 1), WORK_START_HOUR);
			continue;
		}
		const minutesLeftToday = Math.floor((dayEnd.getTime() - cursor.getTime()) / 60_000);
		if (remaining <= minutesLeftToday) {
			return fromZonedTime(addMinutes(cursor, remaining), TZ);
		}
		remaining -= minutesLeftToday;
		cursor = atHour(addDays(cursor, 1), WORK_START_HOUR);
	}
}

export type SlaStatus = 'met' | 'due_soon' | 'overdue' | 'pending';

export function slaStatus(
	ticket: {
		createdAt: Date;
		firstRespondedAt: Date | null;
		priority: TicketPriority;
		status: TicketStatus;
	},
	now: Date
): SlaStatus {
	const dueAt = computeSlaDueAt(ticket.createdAt, ticket.priority);

	if (ticket.firstRespondedAt) {
		return ticket.firstRespondedAt.getTime() <= dueAt.getTime() ? 'met' : 'overdue';
	}
	if (now.getTime() > dueAt.getTime()) return 'overdue';

	const total = dueAt.getTime() - ticket.createdAt.getTime();
	const left = dueAt.getTime() - now.getTime();
	return left / total < 0.25 ? 'due_soon' : 'pending';
}
