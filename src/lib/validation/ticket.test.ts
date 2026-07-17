import { describe, it, expect } from 'vitest';
import { manualTicketSchema, replySchema, noteSchema, assignCompanySchema } from './ticket';

describe('manualTicketSchema', () => {
	it('akzeptiert ein minimales manuelles ticket', () => {
		const result = manualTicketSchema.safeParse({ subject: 'Anruf: Drucker', priority: 'normal' });
		expect(result.success).toBe(true);
	});

	it('verlangt einen betreff', () => {
		const result = manualTicketSchema.safeParse({ subject: '', priority: 'normal' });
		expect(result.success).toBe(false);
		if (!result.success) expect(result.error.issues[0].message).toBe('Betreff ist Pflicht');
	});

	it('verlangt eine gültige empfänger-adresse, wenn eine erst-mail geschickt wird', () => {
		expect(
			manualTicketSchema.safeParse({
				subject: 'Wartung',
				priority: 'high',
				initialMailHtml: '<p>Hallo</p>',
				to: 'keine-mail'
			}).success
		).toBe(false);
		expect(
			manualTicketSchema.safeParse({
				subject: 'Wartung',
				priority: 'high',
				initialMailHtml: '<p>Hallo</p>',
				to: 'max@muster.de'
			}).success
		).toBe(true);
	});
});

describe('replySchema', () => {
	it('verlangt inhalt und gültigen empfänger', () => {
		expect(replySchema.safeParse({ bodyHtml: '', to: 'max@muster.de' }).success).toBe(false);
		expect(replySchema.safeParse({ bodyHtml: '<p>x</p>', to: 'nix' }).success).toBe(false);
		expect(
			replySchema.safeParse({ bodyHtml: '<p>x</p>', to: 'max@muster.de', setStatus: 'resolved' })
				.success
		).toBe(true);
	});
});

describe('noteSchema', () => {
	it('verlangt inhalt', () => {
		expect(noteSchema.safeParse({ bodyHtml: '' }).success).toBe(false);
		expect(noteSchema.safeParse({ bodyHtml: '<p>intern</p>' }).success).toBe(true);
	});
});

describe('assignCompanySchema', () => {
	it('verlangt eine firma, kontakt-anlage optional mit namen', () => {
		expect(assignCompanySchema.safeParse({ companyId: 'keine-uuid' }).success).toBe(false);
		expect(
			assignCompanySchema.safeParse({ companyId: '16e18d55-4002-46f8-b07b-2a8c9cb565aa' }).success
		).toBe(true);
		expect(
			assignCompanySchema.safeParse({
				companyId: '16e18d55-4002-46f8-b07b-2a8c9cb565aa',
				saveContact: 'on',
				firstName: '',
				lastName: ''
			}).success
		).toBe(false);
		expect(
			assignCompanySchema.safeParse({
				companyId: '16e18d55-4002-46f8-b07b-2a8c9cb565aa',
				saveContact: 'on',
				firstName: 'Max',
				lastName: 'Muster'
			}).success
		).toBe(true);
	});
});
