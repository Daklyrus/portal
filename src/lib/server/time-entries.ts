import { and, asc, eq, gte, lt, sql } from 'drizzle-orm';
import { addMonths, format, parseISO } from 'date-fns';
import { user } from './db/auth.schema';
import type { db as defaultDb } from './db';
import { tickets, timeEntries, type TimeEntry } from './db/schema';
import type { TimeEntryInput } from '$lib/validation/timeEntry';

type Db = typeof defaultDb;

export async function addTimeEntry(
	db: Db,
	ticketId: string,
	userId: string,
	input: TimeEntryInput
): Promise<TimeEntry> {
	const [created] = await db
		.insert(timeEntries)
		.values({ ...input, ticketId, userId })
		.returning();
	return created;
}

export async function deleteTimeEntry(db: Db, id: string): Promise<void> {
	await db.delete(timeEntries).where(eq(timeEntries.id, id));
}

export async function listTimeEntries(
	db: Db,
	ticketId: string
): Promise<(TimeEntry & { user: { name: string } | null })[]> {
	const rows = await db
		.select({ entry: timeEntries, user: { name: user.name } })
		.from(timeEntries)
		.leftJoin(user, eq(timeEntries.userId, user.id))
		.where(eq(timeEntries.ticketId, ticketId))
		.orderBy(asc(timeEntries.workDate), asc(timeEntries.createdAt));
	return rows.map(({ entry, user: entryUser }) => ({ ...entry, user: entryUser }));
}

export interface MonthlyTimeReport {
	entries: {
		id: string;
		workDate: string;
		ticketId: string;
		ticketNumber: number;
		ticketSubject: string;
		userName: string | null;
		note: string | null;
		minutes: number;
		billable: boolean;
	}[];
	billableMinutes: number;
	nonBillableMinutes: number;
}

/** Alle Zeiteinträge einer Firma im Monat (month als 'yyyy-MM') */
export async function monthlyTimeReport(
	db: Db,
	companyId: string,
	month: string
): Promise<MonthlyTimeReport> {
	const monthStart = `${month}-01`;
	const nextMonthStart = format(addMonths(parseISO(monthStart), 1), 'yyyy-MM-dd');

	const rows = await db
		.select({
			id: timeEntries.id,
			workDate: timeEntries.workDate,
			ticketId: tickets.id,
			ticketNumber: tickets.number,
			ticketSubject: tickets.subject,
			userName: sql<string | null>`${user.name}`,
			note: timeEntries.note,
			minutes: timeEntries.minutes,
			billable: timeEntries.billable
		})
		.from(timeEntries)
		.innerJoin(tickets, eq(timeEntries.ticketId, tickets.id))
		.leftJoin(user, eq(timeEntries.userId, user.id))
		.where(
			and(
				eq(tickets.companyId, companyId),
				gte(timeEntries.workDate, monthStart),
				lt(timeEntries.workDate, nextMonthStart)
			)
		)
		.orderBy(asc(timeEntries.workDate), asc(timeEntries.createdAt));

	return {
		entries: rows,
		billableMinutes: rows.filter((r) => r.billable).reduce((sum, r) => sum + r.minutes, 0),
		nonBillableMinutes: rows.filter((r) => !r.billable).reduce((sum, r) => sum + r.minutes, 0)
	};
}
