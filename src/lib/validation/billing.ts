import { z } from 'zod';

/** "95" oder "95,50" → Cent (> 0) */
export const euroToCents = (message: string) =>
	z
		.string({ message })
		.transform((v, ctx) => {
			const parsed = Number(v.trim().replace(',', '.'));
			if (!Number.isFinite(parsed) || parsed <= 0) {
				ctx.addIssue({ code: z.ZodIssueCode.custom, message });
				return z.NEVER;
			}
			return Math.round(parsed * 100);
		});

export const hourlyRateSchema = z
	.object({ hourlyRate: euroToCents('Stundensatz prüfen') })
	.transform(({ hourlyRate }) => ({ hourlyRateCents: hourlyRate }));
