import { addDays, parseISO, format } from 'date-fns';
import { db } from '$lib/server/db';
import { listSharedContracts } from '$lib/server/portal/queries';
import { computeContractDeadlines } from '$lib/contracts/deadlines';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { portal } = await parent();
	const contracts = await listSharedContracts(db, portal.companyId);
	return {
		contracts: contracts.map((contract) => {
			const deadlines = computeContractDeadlines(contract, new Date());
			return {
				contract,
				renewsAt:
					contract.status === 'active' && deadlines.autoRenews && !deadlines.hasEnded
						? format(addDays(parseISO(deadlines.currentPeriodEnd), 1), 'yyyy-MM-dd')
						: null
			};
		})
	};
};
