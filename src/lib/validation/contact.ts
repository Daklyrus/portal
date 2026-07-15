import { z } from 'zod';

const emptyToNull = <T extends z.ZodTypeAny>(schema: T) =>
	z.preprocess(
		(v) => (typeof v === 'string' && v.trim() === '' ? null : v),
		schema.nullable().default(null)
	);

export const contactSchema = z.object({
	firstName: z.string({ message: 'Vorname ist Pflicht' }).trim().min(1, 'Vorname ist Pflicht'),
	lastName: z.string({ message: 'Nachname ist Pflicht' }).trim().min(1, 'Nachname ist Pflicht'),
	position: emptyToNull(z.string().trim()),
	email: emptyToNull(z.string().trim().email('E-Mail prüfen')),
	phone: emptyToNull(z.string().trim()),
	mobile: emptyToNull(z.string().trim()),
	notes: emptyToNull(z.string().trim())
});

export type ContactInput = z.infer<typeof contactSchema>;
