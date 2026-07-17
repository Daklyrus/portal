import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLexofficeClient } from './client';

const jsonResponse = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
	fetchMock = vi.fn();
});

function client() {
	return createLexofficeClient('test-key', fetchMock as unknown as typeof fetch);
}

const voucher = (id: string, overrides: Record<string, unknown> = {}) => ({
	id,
	voucherType: 'invoice',
	voucherStatus: 'open',
	voucherNumber: `RE-${id}`,
	voucherDate: '2026-07-01T00:00:00.000+02:00',
	dueDate: '2026-07-15T00:00:00.000+02:00',
	totalAmount: 499.9,
	contactId: 'kontakt-1',
	...overrides
});

describe('listInvoices', () => {
	it('paginiert, mappt betrag in cent und normalisiert status', async () => {
		fetchMock
			.mockResolvedValueOnce(
				jsonResponse({ content: [voucher('a'), voucher('b', { voucherStatus: 'paidoff' })], last: false })
			)
			.mockResolvedValueOnce(
				jsonResponse({ content: [voucher('c', { voucherStatus: 'overdue', dueDate: null })], last: true })
			);

		const invoices = await client().listInvoices('2024-07-16');

		expect(invoices).toHaveLength(3);
		expect(invoices[0]).toEqual({
			lexofficeId: 'a',
			voucherNumber: 'RE-a',
			voucherDate: '2026-07-01',
			dueDate: '2026-07-15',
			totalCents: 49990,
			status: 'open',
			contactId: 'kontakt-1'
		});
		expect(invoices[1].status).toBe('paid'); // paidoff → paid
		expect(invoices[2].dueDate).toBeNull();

		const [firstUrl] = fetchMock.mock.calls[0];
		expect(String(firstUrl)).toContain('voucherType=invoice');
		expect(String(firstUrl)).toContain('voucherDateFrom=2024-07-16');
		const [, opts] = fetchMock.mock.calls[0];
		expect(opts.headers.Authorization).toBe('Bearer test-key');
	});
});

describe('getInvoicePdf', () => {
	it('holt erst die dokument-id, dann die datei', async () => {
		fetchMock
			.mockResolvedValueOnce(jsonResponse({ documentFileId: 'file-9' }))
			.mockResolvedValueOnce(
				new Response(new Uint8Array([1, 2, 3]).buffer, {
					status: 200,
					headers: { 'Content-Disposition': 'attachment; filename="RE-1001.pdf"' }
				})
			);

		const pdf = await client().getInvoicePdf('inv-1');
		expect(pdf.fileName).toBe('RE-1001.pdf');
		expect(pdf.data.byteLength).toBe(3);
		expect(String(fetchMock.mock.calls[0][0])).toContain('/invoices/inv-1/document');
		expect(String(fetchMock.mock.calls[1][0])).toContain('/files/file-9');
	});
});

describe('createInvoiceDraft', () => {
	it('postet den entwurf und liefert die id zurück', async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'entwurf-1' }, 201));

		const draft = {
			voucherDate: '2026-06-30T12:00:00.000+02:00',
			address: { contactId: 'lex-kontakt-1' },
			lineItems: [
				{
					type: 'custom' as const,
					name: 'Managed Basic — Juni 2026',
					quantity: 1,
					unitName: 'Monat',
					unitPrice: { currency: 'EUR' as const, netAmount: 499, taxRatePercentage: 19 as const }
				}
			],
			totalPrice: { currency: 'EUR' as const },
			taxConditions: { taxType: 'net' as const },
			title: 'Rechnung',
			introduction: 'Leistungszeitraum 01.06.2026 – 30.06.2026'
		};

		const result = await client().createInvoiceDraft(draft);

		expect(result.id).toBe('entwurf-1');
		const [invoiceUrl, opts] = fetchMock.mock.calls[0];
		expect(String(invoiceUrl)).toBe('https://api.lexoffice.io/v1/invoices');
		expect(String(invoiceUrl)).not.toContain('finalize');
		expect(opts.method).toBe('POST');
		expect(JSON.parse(opts.body).address.contactId).toBe('lex-kontakt-1');
	});
});
