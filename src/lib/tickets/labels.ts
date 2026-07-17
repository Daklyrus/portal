import type { TicketPriority, TicketStatus } from '$lib/server/db/schema';
import type { SlaStatus } from './sla';

export const statusLabels: Record<TicketStatus, string> = {
	new: 'Neu',
	in_progress: 'In Arbeit',
	waiting_customer: 'Wartet auf Kunde',
	resolved: 'Gelöst',
	closed: 'Geschlossen'
};

export const statusTones: Record<TicketStatus, string> = {
	new: 'bg-accent/10 text-accent',
	in_progress: 'bg-emerald-100 text-emerald-800',
	waiting_customer: 'bg-amber-100 text-amber-800',
	resolved: 'bg-muted text-secondary',
	closed: 'bg-muted text-secondary'
};

export const priorityLabels: Record<TicketPriority, string> = {
	normal: 'Normal',
	high: 'Hoch',
	critical: 'Kritisch'
};

export const priorityTones: Record<TicketPriority, string> = {
	normal: 'bg-muted text-secondary',
	high: 'bg-amber-100 text-amber-800',
	critical: 'bg-destructive/10 text-destructive'
};

export const slaLabels: Record<SlaStatus, string> = {
	met: 'SLA erfüllt',
	pending: 'Im Rahmen',
	due_soon: 'Bald fällig',
	overdue: 'Überfällig'
};

export const slaTones: Record<SlaStatus, string> = {
	met: 'bg-emerald-100 text-emerald-800',
	pending: 'bg-muted text-secondary',
	due_soon: 'bg-amber-100 text-amber-800',
	overdue: 'bg-destructive/10 text-destructive'
};

/** Kundengerechte Status-Texte fürs Portal */
export const portalStatusLabels: Record<TicketStatus, string> = {
	new: 'Eingegangen',
	in_progress: 'In Bearbeitung',
	waiting_customer: 'Wartet auf Ihre Rückmeldung',
	resolved: 'Gelöst — bitte bestätigen',
	closed: 'Abgeschlossen'
};

export const statusOptions = (Object.keys(statusLabels) as TicketStatus[]).map((value) => ({
	value,
	label: statusLabels[value]
}));

export const priorityOptions = (Object.keys(priorityLabels) as TicketPriority[]).map((value) => ({
	value,
	label: priorityLabels[value]
}));
