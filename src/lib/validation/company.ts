import { z } from 'zod';

/** Leere Eingaben optionaler Felder als null speichern statt als leeren String */
const emptyToNull = <T extends z.ZodTypeAny>(schema: T) =>
	z.preprocess(
		(v) => (typeof v === 'string' && v.trim() === '' ? null : v),
		schema.nullable().default(null)
	);

/** Leer = globaler Standard; sonst Euro → Cent */
const optionalRate = z
	.string()
	.optional()
	.default('')
	.transform((v, ctx) => {
		const trimmed = v.trim();
		if (trimmed === '') return null;
		const parsed = Number(trimmed.replace(',', '.'));
		if (!Number.isFinite(parsed) || parsed <= 0) {
			ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Stundensatz prüfen' });
			return z.NEVER;
		}
		return Math.round(parsed * 100);
	});

export const companySchema = z.object({
	name: z.string({ message: 'Name ist Pflicht' }).trim().min(1, 'Name ist Pflicht'),
	customerNumber: emptyToNull(z.string().trim()),
	street: emptyToNull(z.string().trim()),
	zip: emptyToNull(z.string().trim().regex(/^\d{4,5}$/, 'PLZ prüfen')),
	city: emptyToNull(z.string().trim()),
	email: emptyToNull(z.string().trim().email('E-Mail prüfen')),
	phone: emptyToNull(z.string().trim()),
	website: emptyToNull(z.string().trim()),
	notes: emptyToNull(z.string().trim()),
	// Stufe 3: Verknüpfung zum lexoffice-Kontakt für den Rechnungs-Sync
	lexofficeContactId: emptyToNull(z.string().trim()),
	// Stufe 4: Firmen-Stundensatz (leer = globaler Standard)
	hourlyRate: optionalRate
})
	.transform(({ hourlyRate, ...rest }) => ({ ...rest, hourlyRateCents: hourlyRate }));

export type CompanyInput = z.infer<typeof companySchema>;
