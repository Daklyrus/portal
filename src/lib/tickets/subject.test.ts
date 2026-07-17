import { describe, it, expect } from 'vitest';
import { parseTicketNumber, subjectWithNumber } from './subject';

describe('parseTicketNumber', () => {
	it('findet die nummer irgendwo im betreff, case-insensitiv', () => {
		expect(parseTicketNumber('Re: Drucker kaputt [#T-1042]')).toBe(1042);
		expect(parseTicketNumber('[#t-1001] AW: Serverproblem')).toBe(1001);
		expect(parseTicketNumber('Fwd: [#T-2000] und mehr Text')).toBe(2000);
	});

	it('liefert null ohne gültige nummer', () => {
		expect(parseTicketNumber('Drucker kaputt')).toBeNull();
		expect(parseTicketNumber('Ticket T-1042 ohne klammern')).toBeNull();
		expect(parseTicketNumber('[#T-] leer')).toBeNull();
		expect(parseTicketNumber('')).toBeNull();
	});
});

describe('subjectWithNumber', () => {
	it('hängt die nummer an', () => {
		expect(subjectWithNumber('Drucker kaputt', 1042)).toBe('Drucker kaputt [#T-1042]');
	});

	it('ist idempotent, wenn die nummer schon drinsteht', () => {
		expect(subjectWithNumber('Re: Drucker [#T-1042]', 1042)).toBe('Re: Drucker [#T-1042]');
	});
});
