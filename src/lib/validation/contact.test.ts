import { describe, it, expect } from 'vitest';
import { contactSchema } from './contact';

describe('contactSchema', () => {
	it('akzeptiert einen vollständigen Kontakt', () => {
		const result = contactSchema.safeParse({
			firstName: 'Max',
			lastName: 'Muster',
			position: 'IT-Leitung',
			email: 'max@muster.de',
			phone: '05241 123',
			mobile: '0171 456',
			notes: 'Erreichbar ab 9 Uhr'
		});
		expect(result.success).toBe(true);
	});

	it('verlangt vor- und nachnamen mit deutschen meldungen', () => {
		const result = contactSchema.safeParse({ firstName: '', lastName: '' });
		expect(result.success).toBe(false);
		if (!result.success) {
			const messages = result.error.issues.map((i) => i.message);
			expect(messages).toContain('Vorname ist Pflicht');
			expect(messages).toContain('Nachname ist Pflicht');
		}
	});

	it('lehnt ungültige E-Mail ab, erlaubt aber leere', () => {
		expect(contactSchema.safeParse({ firstName: 'M', lastName: 'M', email: 'x' }).success).toBe(false);
		expect(contactSchema.safeParse({ firstName: 'M', lastName: 'M', email: '' }).success).toBe(true);
	});
});
