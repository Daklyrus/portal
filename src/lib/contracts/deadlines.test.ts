import { describe, it, expect } from 'vitest';
import { computeContractDeadlines } from './deadlines';

const base = {
	startDate: '2026-01-01',
	initialTermMonths: 12,
	renewalTermMonths: 12,
	noticePeriodMonths: 3
};

describe('computeContractDeadlines', () => {
	it('berechnet Periodenende und Kündigungsdeadline der Erstlaufzeit', () => {
		const d = computeContractDeadlines(base, new Date('2026-07-15'));
		expect(d.currentPeriodEnd).toBe('2026-12-31');
		expect(d.cancellationDeadline).toBe('2026-09-30');
		expect(d.daysUntilCancellationDeadline).toBe(77);
		expect(d.autoRenews).toBe(true);
		expect(d.hasEnded).toBe(false);
	});

	it('rollt nach Ablauf in die Verlängerungsperiode', () => {
		const d = computeContractDeadlines(base, new Date('2027-02-01'));
		expect(d.currentPeriodEnd).toBe('2027-12-31');
		expect(d.cancellationDeadline).toBe('2027-09-30');
		expect(d.hasEnded).toBe(false);
	});

	it('meldet verpasste Frist mit negativen Tagen', () => {
		const d = computeContractDeadlines(base, new Date('2026-10-15'));
		expect(d.currentPeriodEnd).toBe('2026-12-31');
		expect(d.daysUntilCancellationDeadline).toBe(-15);
	});

	it('auslaufender Vertrag (renewal 0) endet statt zu rollen', () => {
		const d = computeContractDeadlines({ ...base, renewalTermMonths: 0 }, new Date('2027-02-01'));
		expect(d.currentPeriodEnd).toBe('2026-12-31');
		expect(d.hasEnded).toBe(true);
		expect(d.autoRenews).toBe(false);
	});
});
