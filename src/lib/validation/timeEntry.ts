import { z } from 'zod';

export const timeEntrySchema = z.object({
	minutes: z.coerce
		.number({ message: 'Minuten prüfen' })
		.int('Minuten prüfen')
		.min(1, 'Minuten prüfen'),
	note: z.preprocess(
		(v) => (typeof v === 'string' && v.trim() === '' ? null : v),
		z.string().trim().nullable().default(null)
	),
	billable: z.preprocess((v) => v === 'on' || v === true, z.boolean()),
	workDate: z
		.string({ message: 'Datum prüfen' })
		.regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum prüfen')
});

export type TimeEntryInput = z.infer<typeof timeEntrySchema>;
