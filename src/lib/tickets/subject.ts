const TICKET_TAG = /\[#t-(\d+)\]/i;

export function parseTicketNumber(subject: string): number | null {
	const match = subject.match(TICKET_TAG);
	return match ? Number.parseInt(match[1], 10) : null;
}

export function subjectWithNumber(subject: string, number: number): string {
	if (parseTicketNumber(subject) === number) return subject;
	return `${subject} [#T-${number}]`;
}
