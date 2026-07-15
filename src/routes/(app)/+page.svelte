<script lang="ts">
	import { resolve } from '$app/paths';
	import { CalendarClock } from 'lucide-svelte';
	import DeadlineBadge from '$lib/components/DeadlineBadge.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Dashboard – Corvion Tool</title></svelte:head>

<h1 class="font-display text-2xl font-semibold">Dashboard</h1>
<p class="mt-1 text-sm text-secondary">Angemeldet als {data.user.name}.</p>

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
