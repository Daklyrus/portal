import { z } from 'zod';

/** Leere Eingaben optionaler Felder als null speichern statt als leeren String */
const emptyToNull = <T extends z.ZodTypeAny>(schema: T) =>
	z.preprocess(
		(v) => (typeof v === 'string' && v.trim() === '' ? null : v),
		schema.nullable().default(null)
	);

export const companySchema = z.object({
	name: z.string({ message: 'Name ist Pflicht' }).trim().min(1, 'Name ist Pflicht'),
	customerNumber: emptyToNull(z.string().trim()),
	street: emptyToNull(z.string().trim()),
	zip: emptyToNull(z.string().trim().regex(/^\d{4,5}$/, 'PLZ prüfen')),
	city: emptyToNull(z.string().trim()),
	email: emptyToNull(z.string().trim().email('E-Mail prüfen')),
	phone: emptyToNull(z.string().trim()),
	website: emptyToNull(z.string().trim()),
	notes: emptyToNull(z.string().trim())
});

export type CompanyInput = z.infer<typeof companySchema>;
