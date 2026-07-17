<script lang="ts">
	import { resolve } from '$app/paths';
	import { CalendarClock, Ticket } from 'lucide-svelte';
	import DeadlineBadge from '$lib/components/DeadlineBadge.svelte';
	import { slaLabels, slaTones } from '$lib/tickets/labels';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const tiles = $derived([
		{ label: 'Offene Tickets', value: data.ticketStats.open, tone: 'text-foreground' },
		{ label: 'Neu', value: data.ticketStats.fresh, tone: 'text-accent' },
		{
			label: 'SLA überfällig',
			value: data.ticketStats.overdue,
			tone: data.ticketStats.overdue > 0 ? 'text-destructive' : 'text-foreground'
		}
	]);
</script>

<svelte:head><title>Dashboard – Corvion Tool</title></svelte:head>

<h1 class="font-display text-2xl font-semibold">Dashboard</h1>
<p class="mt-1 text-sm text-secondary">Angemeldet als {data.user.name}.</p>

<div class="mt-6 grid max-w-2xl grid-cols-3 gap-4">
	{#each tiles as tile (tile.label)}
		<div class="rounded-lg border border-border bg-white p-4">
			<p class="text-xs font-semibold uppercase tracking-wide text-secondary">{tile.label}</p>
			<p class="mt-1 font-display text-3xl font-semibold {tile.tone}">{tile.value}</p>
		</div>
	{/each}
</div>

<section class="mt-6 max-w-2xl rounded-lg border border-border bg-white p-6">
	<h2 class="flex items-center gap-2 font-display text-lg font-semibold">
		<Ticket size={18} aria-hidden="true" class="text-accent" />
		Dringende Tickets
	</h2>
	{#if data.urgentTickets.length === 0}
		<p class="mt-3 text-sm text-secondary">Keine überfälligen oder bald fälligen Tickets.</p>
	{:else}
		<ul class="mt-4 space-y-2">
			{#each data.urgentTickets as item (item.ticket.id)}
				<li class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
					<div>
						<a
							href={resolve('/(app)/tickets/[id]', { id: item.ticket.id })}
							class="font-semibold text-accent hover:underline"
						>
							<span class="font-mono text-xs">T-{item.ticket.number}</span>
							{item.ticket.subject}
						</a>
						<p class="text-sm text-secondary">{item.company?.name ?? 'Nicht zugeordnet'}</p>
					</div>
					<span class="rounded-full px-2 py-0.5 text-xs font-semibold {slaTones[item.sla]}">
						{slaLabels[item.sla]}
					</span>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<section class="mt-6 max-w-2xl rounded-lg border border-border bg-white p-6">
	<h2 class="flex items-center gap-2 font-display text-lg font-semibold">
		<CalendarClock size={18} aria-hidden="true" class="text-accent" />
		Anstehende Kündigungsfristen (90 Tage)
	</h2>

	{#if data.upcomingDeadlines.length === 0}
		<p class="mt-3 text-sm text-secondary">Keine Fristen in den nächsten 90 Tagen.</p>
	{:else}
		<ul class="mt-4 space-y-3">
			{#each data.upcomingDeadlines as { company, contract, deadlines } (contract.id)}
				<li class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
					<div>
						<a
							href={resolve('/(app)/firmen/[id]', { id: company.id })}
							class="font-semibold text-accent hover:underline"
						>
							{company.name}
						</a>
						<p class="text-sm text-secondary">{contract.title}</p>
					</div>
					<DeadlineBadge {deadlines} />
				</li>
			{/each}
		</ul>
	{/if}
</section>
