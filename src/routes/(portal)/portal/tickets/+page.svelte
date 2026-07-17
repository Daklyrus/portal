<script lang="ts">
	import { resolve } from '$app/paths';
	import { Plus } from 'lucide-svelte';
	import { portalStatusLabels, statusTones } from '$lib/tickets/labels';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const dateFormat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' });
</script>

<svelte:head><title>Anfragen – Corvion Portal</title></svelte:head>

<div class="flex items-center justify-between gap-4">
	<h1 class="font-display text-2xl font-semibold">Anfragen</h1>
	<a
		href={resolve('/portal/tickets/neu')}
		class="flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-colors duration-150 hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
	>
		<Plus size={16} aria-hidden="true" />
		Neue Anfrage
	</a>
</div>

{#if data.tickets.length === 0}
	<div class="mt-8 rounded-lg border border-border bg-white p-8 text-center">
		<p class="font-semibold">Noch keine Anfragen.</p>
		<p class="mt-1 text-sm text-secondary">Stellen Sie Ihre erste Anfrage — wir kümmern uns.</p>
	</div>
{:else}
	<div class="mt-6 overflow-x-auto rounded-lg border border-border bg-white">
		<table class="w-full text-left text-sm">
			<thead class="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-secondary">
				<tr>
					<th scope="col" class="px-4 py-3">Nr.</th>
					<th scope="col" class="px-4 py-3">Betreff</th>
					<th scope="col" class="px-4 py-3">Status</th>
					<th scope="col" class="px-4 py-3">Letzte Aktivität</th>
				</tr>
			</thead>
			<tbody>
				{#each data.tickets as { ticket } (ticket.id)}
					<tr class="border-b border-border last:border-b-0 hover:bg-muted/40">
						<td class="px-4 py-3 font-mono text-xs">T-{ticket.number}</td>
						<td class="px-4 py-3">
							<a
								href={resolve('/(portal)/portal/tickets/[id]', { id: ticket.id })}
								class="font-semibold text-accent hover:underline"
							>
								{ticket.subject}
							</a>
						</td>
						<td class="px-4 py-3">
							<span class="rounded-full px-2 py-0.5 text-xs font-semibold {statusTones[ticket.status]}">
								{portalStatusLabels[ticket.status]}
							</span>
						</td>
						<td class="px-4 py-3">{dateFormat.format(ticket.updatedAt)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
