import { z } from 'zod';

const emptyToNull = <T extends z.ZodTypeAny>(schema: T) =>
	z.preprocess(
		(v) => (typeof v === 'string' && v.trim() === '' ? null : v),
		schema.nullable().default(null)
	);

const monthsField = (message: string) =>
	z.coerce.number({ message }).int(message).min(0, message);

/** "499,90", "499.90" oder "500" → Cent (leer = 0) */
const feeToCents = z
	.string()
	.default('')
	.transform((v, ctx) => {
		const trimmed = v.trim();
		if (trimmed === '') return 0;
		const normalized = trimmed.replace(/\./g, '.').replace(',', '.');
		const parsed = Number(normalized);
		if (!Number.isFinite(parsed) || parsed < 0) {
			ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Betrag prüfen' });
			return z.NEVER;
		}
		return Math.round(parsed * 100);
	});

export const contractSchema = z
	.object({
		title: z.string({ message: 'Titel ist Pflicht' }).trim().min(1, 'Titel ist Pflicht'),
		description: emptyToNull(z.string().trim()),
		status: z.enum(['draft', 'active', 'cancelled', 'ended'], {
			message: 'Status prüfen'
		}),
		startDate: z
			.string({ message: 'Startdatum ist Pflicht' })
			.regex(/^\d{4}-\d{2}-\d{2}$/, 'Startdatum prüfen'),
		initialTermMonths: monthsField('Laufzeit in Monaten prüfen'),
		renewalTermMonths: monthsField('Verlängerung in Monaten prüfen'),
		noticePeriodMonths: monthsField('Kündigungsfrist in Monaten prüfen'),
		monthlyFee: feeToCents,
		includedServices: emptyToNull(z.string().trim()),
		sharedWithCustomer: z.preprocess((v) => v === 'on' || v === true, z.boolean())
	})
	.transform(({ monthlyFee, ...rest }) => ({ ...rest, monthlyFeeCents: monthlyFee }));

export type ContractInput = z.infer<typeof contractSchema>;
