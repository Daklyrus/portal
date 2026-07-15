import { describe, it, expect } from 'vitest';
import { companySchema } from './company';

describe('companySchema', () => {
	it('akzeptiert eine vollständige Firma', () => {
		const result = companySchema.safeParse({
			name: 'Muster GmbH',
			customerNumber: 'K-1001',
			street: 'Hauptstraße 1',
			zip: '33442',
			city: 'Herzebrock-Clarholz',
			email: 'info@muster.de',
			phone: '05245 123456',
			website: 'https://muster.de',
			notes: 'Bestandskunde'
		});
		expect(result.success).toBe(true);
	});

	it('akzeptiert nur den Pflichtnamen, alles andere optional', () => {
		const result = companySchema.safeParse({ name: 'Minimal AG' });
		expect(result.success).toBe(true);
	});

	it('lehnt leeren Namen mit deutscher Meldung ab', () => {
		const result = companySchema.safeParse({ name: '' });
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].message).toBe('Name ist Pflicht');
		}
	});

	it('lehnt ungültige E-Mail ab', () => {
		const result = companySchema.safeParse({ name: 'X GmbH', email: 'keine-mail' });
		expect(result.success).toBe(false);
	});

	it('lehnt ungültige PLZ ab, erlaubt aber leere', () => {
		expect(companySchema.safeParse({ name: 'X', zip: 'abc' }).success).toBe(false);
		expect(companySchema.safeParse({ name: 'X', zip: '' }).success).toBe(true);
	});

	it('wandelt leere Strings optionaler Felder in null', () => {
		const result = companySchema.parse({ name: 'X GmbH', email: '', notes: '' });
		expect(result.email).toBeNull();
		expect(result.notes).toBeNull();
	});
});
