<script lang="ts">
	import { resolve } from '$app/paths';
	import { Download } from 'lucide-svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
	const dateFormat = new Intl.DateTimeFormat('de-DE');

	const statusLabel: Record<string, string> = {
		open: 'Offen',
		paid: 'Bezahlt',
		overdue: 'Überfällig',
		voided: 'Storniert'
	};
	const statusTone: Record<string, string> = {
		open: 'bg-amber-100 text-amber-800',
		paid: 'bg-emerald-100 text-emerald-800',
		overdue: 'bg-destructive/10 text-destructive',
		voided: 'bg-muted text-secondary'
	};
</script>

<svelte:head><title>Rechnungen – Corvion Portal</title></svelte:head>

<h1 class="font-display text-2xl font-semibold">Rechnungen</h1>
<p class="mt-1 text-sm text-secondary">Rechnungen der letzten 24 Monate mit aktuellem Zahlstatus.</p>

{#if data.invoices.length === 0}
	<div class="mt-8 rounded-lg border border-border bg-white p-8 text-center">
		<p class="font-semibold">Noch keine Rechnungen verfügbar.</p>
	</div>
{:else}
	<div class="mt-6 overflow-x-auto rounded-lg border border-border bg-white">
		<table class="w-full text-left text-sm">
			<thead class="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-secondary">
				<tr>
					<th scope="col" class="px-4 py-3">Nummer</th>
					<th scope="col" class="px-4 py-3">Datum</th>
					<th scope="col" class="px-4 py-3">Fällig</th>
					<th scope="col" class="px-4 py-3">Betrag</th>
					<th scope="col" class="px-4 py-3">Status</th>
					<th scope="col" class="px-4 py-3"><span class="sr-only">Download</span></th>
				</tr>
			</thead>
			<tbody>
				{#each data.invoices as invoice (invoice.id)}
					<tr class="border-b border-border last:border-b-0">
						<td class="px-4 py-3 font-semibold">{invoice.voucherNumber}</td>
						<td class="px-4 py-3">{dateFormat.format(new Date(invoice.voucherDate))}</td>
						<td class="px-4 py-3">
							{invoice.dueDate ? dateFormat.format(new Date(invoice.dueDate)) : '–'}
						</td>
						<td class="px-4 py-3">{euro.format(invoice.totalCents / 100)}</td>
						<td class="px-4 py-3">
							<span class="rounded-full px-2 py-0.5 text-xs font-semibold {statusTone[invoice.status]}">
								{statusLabel[invoice.status]}
							</span>
						</td>
						<td class="px-4 py-3">
							<a
								href={resolve('/(portal)/portal/rechnungen/[id]/pdf', { id: invoice.id })}
								class="flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
							>
								<Download size={14} aria-hidden="true" />
								PDF
							</a>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
