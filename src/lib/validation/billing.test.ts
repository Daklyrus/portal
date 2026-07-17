import { describe, it, expect } from 'vitest';
import { hourlyRateSchema } from './billing';
import { companySchema } from './company';

describe('hourlyRateSchema', () => {
	it('wandelt euro-eingaben in cent', () => {
		expect(hourlyRateSchema.parse({ hourlyRate: '95' }).hourlyRateCents).toBe(9500);
		expect(hourlyRateSchema.parse({ hourlyRate: '95,50' }).hourlyRateCents).toBe(9550);
	});

	it('lehnt null, negativ und unsinn ab', () => {
		expect(hourlyRateSchema.safeParse({ hourlyRate: '0' }).success).toBe(false);
		expect(hourlyRateSchema.safeParse({ hourlyRate: '-5' }).success).toBe(false);
		expect(hourlyRateSchema.safeParse({ hourlyRate: 'abc' }).success).toBe(false);
	});
});

describe('companySchema stundensatz', () => {
	it('leer = null (globaler standard), sonst cent', () => {
		expect(companySchema.parse({ name: 'X GmbH' }).hourlyRateCents).toBeNull();
		expect(companySchema.parse({ name: 'X GmbH', hourlyRate: '120' }).hourlyRateCents).toBe(12000);
		expect(companySchema.safeParse({ name: 'X GmbH', hourlyRate: 'quatsch' }).success).toBe(false);
	});
});
