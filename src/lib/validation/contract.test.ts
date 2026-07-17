import { describe, it, expect } from 'vitest';
import { contractSchema } from './contract';

const valid = {
	title: 'Managed Services Basic',
	status: 'active',
	startDate: '2026-01-01',
	initialTermMonths: '12',
	renewalTermMonths: '12',
	noticePeriodMonths: '3',
	monthlyFee: '499,90'
};

describe('contractSchema', () => {
	it('akzeptiert einen gültigen Vertrag und wandelt Werte um', () => {
		const result = contractSchema.parse(valid);
		expect(result.initialTermMonths).toBe(12);
		expect(result.monthlyFeeCents).toBe(49990);
		expect(result.status).toBe('active');
	});

	it('akzeptiert Pauschale mit Punkt und ohne Nachkommastellen', () => {
		expect(contractSchema.parse({ ...valid, monthlyFee: '499.90' }).monthlyFeeCents).toBe(49990);
		expect(contractSchema.parse({ ...valid, monthlyFee: '500' }).monthlyFeeCents).toBe(50000);
		expect(contractSchema.parse({ ...valid, monthlyFee: '' }).monthlyFeeCents).toBe(0);
	});

	it('verlangt titel und gültiges startdatum', () => {
		expect(contractSchema.safeParse({ ...valid, title: '' }).success).toBe(false);
		expect(contractSchema.safeParse({ ...valid, startDate: 'kein-datum' }).success).toBe(false);
	});

	it('lehnt negative monatswerte und unbekannten status ab', () => {
		expect(contractSchema.safeParse({ ...valid, noticePeriodMonths: '-1' }).success).toBe(false);
		expect(contractSchema.safeParse({ ...valid, status: 'egal' }).success).toBe(false);
	});
});

describe('contractSchema portal-freigabe', () => {
	it('wandelt die checkbox in ein boolean', () => {
		expect(contractSchema.parse({ ...valid, sharedWithCustomer: 'on' }).sharedWithCustomer).toBe(true);
		expect(contractSchema.parse(valid).sharedWithCustomer).toBe(false);
	});
});
