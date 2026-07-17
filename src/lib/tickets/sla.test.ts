import { describe, it, expect } from 'vitest';
import { computeSlaDueAt, nrwHolidays, slaStatus, SLA_RESPONSE_MINUTES } from './sla';

describe('nrwHolidays', () => {
	it('kennt feste und bewegliche feiertage 2026', () => {
		const days = nrwHolidays(2026);
		expect(days).toContain('2026-01-01'); // Neujahr
		expect(days).toContain('2026-04-03'); // Karfreitag
		expect(days).toContain('2026-04-06'); // Ostermontag
		expect(days).toContain('2026-05-14'); // Christi Himmelfahrt
		expect(days).toContain('2026-05-25'); // Pfingstmontag
		expect(days).toContain('2026-06-04'); // Fronleichnam
		expect(days).toContain('2026-11-01'); // Allerheiligen
		expect(days).not.toContain('2026-08-15'); // Mariä Himmelfahrt gilt in NRW nicht
	});
});

describe('computeSlaDueAt', () => {
	it('addiert innerhalb eines geschäftstags', () => {
		// Do 16.07.2026 09:00 + 120 min → 11:00
		const due = computeSlaDueAt(new Date('2026-07-16T09:00:00+02:00'), 'critical');
		expect(due.toISOString()).toBe(new Date('2026-07-16T11:00:00+02:00').toISOString());
	});

	it('rollt über nacht und wochenende', () => {
		// Fr 17.07.2026 16:30 + 120 min → 30 min Fr + 90 min Mo → Mo 09:30
		const due = computeSlaDueAt(new Date('2026-07-17T16:30:00+02:00'), 'critical');
		expect(due.toISOString()).toBe(new Date('2026-07-20T09:30:00+02:00').toISOString());
	});

	it('startet bei eingang außerhalb der geschäftszeit am nächsten arbeitstag', () => {
		// Sa 18.07.2026 12:00, Normal 480 min → Mo 08:00 + 480 min = Mo 16:00
		const due = computeSlaDueAt(new Date('2026-07-18T12:00:00+02:00'), 'normal');
		expect(due.toISOString()).toBe(new Date('2026-07-20T16:00:00+02:00').toISOString());
	});

	it('überspringt feiertage', () => {
		// Do 30.04.2026 16:00 + 240 min (high) → 60 min Do, 1. Mai (Fr) frei → Mo 04.05. 08:00 + 180 min = 11:00
		const due = computeSlaDueAt(new Date('2026-04-30T16:00:00+02:00'), 'high');
		expect(due.toISOString()).toBe(new Date('2026-05-04T11:00:00+02:00').toISOString());
	});
});

describe('slaStatus', () => {
	const base = {
		createdAt: new Date('2026-07-16T09:00:00+02:00'),
		priority: 'critical' as const, // fällig 11:00
		status: 'new' as const,
		firstRespondedAt: null as Date | null
	};

	it('met: erste antwort vor fälligkeit', () => {
		expect(
			slaStatus(
				{ ...base, firstRespondedAt: new Date('2026-07-16T10:00:00+02:00') },
				new Date('2026-07-16T12:00:00+02:00')
			)
		).toBe('met');
	});

	it('overdue: fälligkeit ohne antwort verstrichen', () => {
		expect(slaStatus(base, new Date('2026-07-16T11:01:00+02:00'))).toBe('overdue');
	});

	it('due_soon: weniger als 25 % der frist übrig', () => {
		// 120 min Frist, 25 % = 30 min → ab 10:30 due_soon
		expect(slaStatus(base, new Date('2026-07-16T10:45:00+02:00'))).toBe('due_soon');
	});

	it('pending: noch reichlich zeit', () => {
		expect(slaStatus(base, new Date('2026-07-16T09:10:00+02:00'))).toBe('pending');
	});

	it('sla-minuten sind wie abgestimmt konfiguriert', () => {
		expect(SLA_RESPONSE_MINUTES).toEqual({ critical: 120, high: 240, normal: 480 });
	});
});
