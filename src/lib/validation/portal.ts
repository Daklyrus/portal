import { z } from 'zod';

export const portalTicketSchema = z.object({
	subject: z.string({ message: 'Betreff ist Pflicht' }).trim().min(1, 'Betreff ist Pflicht'),
	body: z
		.string({ message: 'Beschreibung ist Pflicht' })
		.trim()
		.min(1, 'Beschreibung ist Pflicht')
});

export const portalReplySchema = z.object({
	body: z
		.string({ message: 'Antwort darf nicht leer sein' })
		.trim()
		.min(1, 'Antwort darf nicht leer sein')
});
