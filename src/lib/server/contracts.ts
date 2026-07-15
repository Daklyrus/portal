import { asc, eq, inArray } from 'drizzle-orm';
import type { db as defaultDb } from './db';
import { companies, contracts, type Company, type Contract } from './db/schema';
import { computeContractDeadlines, type ContractDeadlines } from '$lib/contracts/deadlines';
import type { ContractInput } from '$lib/validation/contract';

type Db = typeof defaultDb;

export interface ContractWithDeadlines {
	contract: Contract;
	deadlines: ContractDeadlines;
}

export interface UpcomingDeadline extends ContractWithDeadlines {
	company: Company;
}

export async function createContract(
	db: Db,
	companyId: string,
	input: ContractInput
): Promise<Contract> {
	const [created] = await db.insert(contracts).values({ ...input, companyId }).returning();
	return created;
}

export async function updateContract(db: Db, id: string, input: ContractInput): Promise<void> {
	await db
		.update(contracts)
		.set({ ...input, updatedAt: new Date() })
		.where(eq(contracts.id, id));
}

export async function deleteContract(db: Db, id: string): Promise<void> {
	await db.delete(contracts).where(eq(contracts.id, id));
}

export async function markContractCancelled(db: Db, id: string, cancelledAt: string): Promise<void> {
	await db
		.update(contracts)
		.set({ status: 'cancelled', cancelledAt, updatedAt: new Date() })
		.where(eq(contracts.id, id));
}

export async function listContractsWithDeadlines(
	db: Db,
	companyId: string,
	today: Date
): Promise<ContractWithDeadlines[]> {
	const rows = await db
		.select()
		.from(contracts)
		.where(eq(contracts.companyId, companyId))
		.orderBy(asc(contracts.startDate));
	return rows.map((contract) => ({ contract, deadlines: computeContractDeadlines(contract, today) }));
}

/** Aktive Verträge, deren Kündigungsdeadline innerhalb von `withinDays` liegt (auch knapp verpasste zeigen wir nicht) */
export async function getUpcomingDeadlines(
	db: Db,
	withinDays: number,
	today: Date
): Promise<UpcomingDeadline[]> {
	const rows = await db
		.select({ contract: contracts, company: companies })
		.from(contracts)
		.innerJoin(companies, eq(contracts.companyId, companies.id))
		.where(inArray(contracts.status, ['active']));

	return rows
		.map(({ contract, company }) => ({
			contract,
			company,
			deadlines: computeContractDeadlines(contract, today)
		}))
		.filter(
			({ deadlines }) =>
				!deadlines.hasEnded &&
				deadlines.daysUntilCancellationDeadline >= 0 &&
				deadlines.daysUntilCancellationDeadline <= withinDays
		)
		.sort(
			(a, b) => a.deadlines.daysUntilCancellationDeadline - b.deadlines.daysUntilCancellationDeadline
		);
}
