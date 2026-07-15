<script lang="ts">
	import type { ContractDeadlines } from '$lib/contracts/deadlines';

	let { deadlines }: { deadlines: ContractDeadlines } = $props();

	const formatDate = (iso: string) => new Date(iso).toLocaleDateString('de-DE');

	let days = $derived(deadlines.daysUntilCancellationDeadline);

	let tone = $derived.by(() => {
		if (deadlines.hasEnded) return 'bg-muted text-secondary';
		if (days < 0) return 'bg-muted text-secondary';
		if (days <= 30) return 'bg-destructive/10 text-destructive';
		if (days <= 90) return 'bg-amber-100 text-amber-800';
		return 'bg-emerald-100 text-emerald-800';
	});

	let label = $derived.by(() => {
		if (deadlines.hasEnded) return `Ausgelaufen am ${formatDate(deadlines.currentPeriodEnd)}`;
		if (days < 0) {
			return deadlines.autoRenews
				? `Frist verpasst — läuft bis ${formatDate(deadlines.currentPeriodEnd)}`
				: `Läuft aus am ${formatDate(deadlines.currentPeriodEnd)}`;
		}
		return `Kündbar bis ${formatDate(deadlines.cancellationDeadline)} (in ${days} ${days === 1 ? 'Tag' : 'Tagen'})`;
	});
</script>

<span class="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold {tone}">{label}</span>
