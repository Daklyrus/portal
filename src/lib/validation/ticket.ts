import { z } from 'zod';

const priority = z.enum(['normal', 'high', 'critical'], { message: 'Priorität prüfen' });
const status = z.enum(['new', 'in_progress', 'waiting_customer', 'resolved', 'closed'], {
	message: 'Status prüfen'
});

const optionalUuid = z.preprocess(
	(v) => (typeof v === 'string' && v.trim() === '' ? null : v),
	z.string().uuid('Auswahl prüfen').nullable().default(null)
);

/** Leerer Editor liefert '<p></p>' — als leer behandeln */
const richText = (message: string) =>
	z
		.string({ message })
		.transform((v) => v.trim())
		.refine((v) => v !== '' && v.replace(/<p>\s*<\/p>/g, '').trim() !== '', { message });

export const manualTicketSchema = z
	.object({
		subject: z.string({ message: 'Betreff ist Pflicht' }).trim().min(1, 'Betreff ist Pflicht'),
		priority,
		companyId: optionalUuid,
		contactId: optionalUuid,
		description: z.string().trim().optional().default(''),
		initialMailHtml: z.string().trim().optional().default(''),
		to: z.string().trim().optional().default('')
	})
	.superRefine((data, ctx) => {
		const wantsMail = data.initialMailHtml.replace(/<p>\s*<\/p>/g, '').trim() !== '';
		if (wantsMail && !z.string().email().safeParse(data.to).success) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['to'],
				message: 'Empfänger-Adresse prüfen'
			});
		}
	});

export const replySchema = z.object({
	bodyHtml: richText('Antwort darf nicht leer sein'),
	to: z.string({ message: 'Empfänger prüfen' }).trim().email('Empfänger-Adresse prüfen'),
	setStatus: z.preprocess((v) => (v === '' || v == null ? undefined : v), status.optional())
});

export const noteSchema = z.object({
	bodyHtml: richText('Notiz darf nicht leer sein')
});

export const statusSchema = z.object({ status });

export const prioritySchema = z.object({ priority });

export const assignUserSchema = z.object({
	assignedToId: z.preprocess(
		(v) => (typeof v === 'string' && v.trim() === '' ? null : v),
		z.string().nullable().default(null)
	)
});

export const assignCompanySchema = z
	.object({
		companyId: z.string({ message: 'Firma wählen' }).uuid('Firma wählen'),
		contactId: optionalUuid,
		saveContact: z.preprocess((v) => v === 'on', z.boolean()),
		firstName: z.string().trim().optional().default(''),
		lastName: z.string().trim().optional().default('')
	})
	.superRefine((data, ctx) => {
		if (data.saveContact) {
			if (!data.firstName) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['firstName'],
					message: 'Vorname ist Pflicht'
				});
			}
			if (!data.lastName) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['lastName'],
					message: 'Nachname ist Pflicht'
				});
			}
		}
	});

export type ManualTicketInput = z.infer<typeof manualTicketSchema>;
export type ReplyInput = z.infer<typeof replySchema>;
