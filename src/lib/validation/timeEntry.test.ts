import { describe, it, expect } from 'vitest';
import { timeEntrySchema } from './timeEntry';

describe('timeEntrySchema', () => {
	it('akzeptiert einen gültigen eintrag und wandelt werte', () => {
		const result = timeEntrySchema.parse({
			minutes: '45',
			note: 'Fernwartung',
			billable: 'on',
			workDate: '2026-07-16'
		});
		expect(result.minutes).toBe(45);
		expect(result.billable).toBe(true);
	});

	it('checkbox fehlt → nicht abrechenbar', () => {
		const result = timeEntrySchema.parse({ minutes: '30', workDate: '2026-07-16' });
		expect(result.billable).toBe(false);
		expect(result.note).toBeNull();
	});

	it('lehnt null-, negative und krumme minuten ab', () => {
		expect(timeEntrySchema.safeParse({ minutes: '0', workDate: '2026-07-16' }).success).toBe(false);
		expect(timeEntrySchema.safeParse({ minutes: '-15', workDate: '2026-07-16' }).success).toBe(false);
		expect(timeEntrySchema.safeParse({ minutes: 'abc', workDate: '2026-07-16' }).success).toBe(false);
	});

	it('lehnt kaputtes datum ab', () => {
		expect(timeEntrySchema.safeParse({ minutes: '30', workDate: 'gestern' }).success).toBe(false);
	});
});
