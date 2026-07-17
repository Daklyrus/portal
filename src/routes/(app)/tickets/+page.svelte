<script lang="ts">
	import { resolve } from '$app/paths';
	import { Plus } from 'lucide-svelte';
	import { computeSlaDueAt } from '$lib/tickets/sla';
	import {
		priorityLabels,
		priorityOptions,
		priorityTones,
		slaLabels,
		slaTones,
		statusLabels,
		statusOptions,
		statusTones
	} from '$lib/tickets/labels';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const dueText = (ticket: PageData['tickets'][number]['ticket']) =>
		computeSlaDueAt(ticket.createdAt, ticket.priority).toLocaleString('de-DE', {
			day: '2-digit',
			month: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		});
</script>

<svelte:head><title>Tickets – Corvion Tool</title></svelte:head>

<div class="flex items-center justify-between gap-4">
	<h1 class="font-display text-2xl font-semibold">Tickets</h1>
	<a
		href={resolve('/tickets/neu')}
		class="flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-colors duration-150 hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
	>
		<Plus size={16} aria-hidden="true" />
		Neues Ticket
	</a>
</div>

<form method="get" class="mt-4 flex flex-wrap items-end gap-3">
	<div>
		<label for="status" class="block text-sm font-semibold">Status</label>
		<select id="status" name="status" class="mt-1 rounded-md border-border text-sm focus:border-accent focus:ring-accent">
			<option value="open" selected={data.filter.status === 'open'}>Offen (alle)</option>
			{#each statusOptions as option (option.value)}
				<option value={option.value} selected={data.filter.status === option.value}>{option.label}</option>
			{/each}
		</select>
	</div>
	<div>
		<label for="priority" class="block text-sm font-semibold">Priorität</label>
		<select id="priority" name="priority" class="mt-1 rounded-md border-border text-sm focus:border-accent focus:ring-accent">
			<option value="" selected={data.filter.priority === ''}>Alle</option>
			{#each priorityOptions as option (option.value)}
				<option value={option.value} selected={data.filter.priority === option.value}>{option.label}</option>
			{/each}
		</select>
	</div>
	<div>
		<label for="bearbeiter" class="block text-sm font-semibold">Bearbeiter</label>
		<select id="bearbeiter" name="bearbeiter" class="mt-1 rounded-md border-border text-sm focus:border-accent focus:ring-accent">
			<option value="" selected={data.filter.bearbeiter === ''}>Alle</option>
			{#each data.users as user (user.id)}
				<option value={user.id} selected={data.filter.bearbeiter === user.id}>{user.name}</option>
			{/each}
		</select>
	</div>
	<button
		type="submit"
		class="cursor-pointer rounded-md border border-border bg-white px-3 py-2 text-sm font-semibold transition-colors duration-150 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
	>
		Filtern
	</button>
</form>

{#if data.tickets.length === 0}
	<div class="mt-8 rounded-lg border border-border bg-white p-8 text-center">
		<p class="font-semibold">Keine Tickets gefunden.</p>
		<p class="mt-1 text-sm text-secondary">Filter anpassen oder neues Ticket anlegen.</p>
	</div>
{:else}
	<div class="mt-6 overflow-x-auto rounded-lg border border-border bg-white">
		<table class="w-full text-left text-sm">
			<thead class="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-secondary">
				<tr>
					<th scope="col" class="px-4 py-3">Nr.</th>
					<th scope="col" class="px-4 py-3">Betreff</th>
					<th scope="col" class="px-4 py-3">Firma</th>
					<th scope="col" class="px-4 py-3">Status</th>
					<th scope="col" class="px-4 py-3">Priorität</th>
					<th scope="col" class="px-4 py-3">SLA</th>
					<th scope="col" class="px-4 py-3">Bearbeiter</th>
				</tr>
			</thead>
			<tbody>
				{#each data.tickets as item (item.ticket.id)}
					<tr class="border-b border-border last:border-b-0 hover:bg-muted/40">
						<td class="px-4 py-3 font-mono text-xs">T-{item.ticket.number}</td>
						<td class="px-4 py-3">
							<a
								href={resolve('/(app)/tickets/[id]', { id: item.ticket.id })}
								class="font-semibold text-accent hover:underline"
							>
								{item.ticket.subject}
							</a>
						</td>
						<td class="px-4 py-3">
							{#if item.company}
								{item.company.name}
							{:else}
								<span class="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
									Nicht zugeordnet
								</span>
							{/if}
						</td>
						<td class="px-4 py-3">
							<span class="rounded-full px-2 py-0.5 text-xs font-semibold {statusTones[item.ticket.status]}">
								{statusLabels[item.ticket.status]}
							</span>
						</td>
						<td class="px-4 py-3">
							<span class="rounded-full px-2 py-0.5 text-xs font-semibold {priorityTones[item.ticket.priority]}">
								{priorityLabels[item.ticket.priority]}
							</span>
						</td>
						<td class="px-4 py-3">
							<span
								class="rounded-full px-2 py-0.5 text-xs font-semibold {slaTones[item.sla]}"
								title={item.sla === 'pending' || item.sla === 'due_soon'
									? `Antwort bis ${dueText(item.ticket)}`
									: undefined}
							>
								{slaLabels[item.sla]}
							</span>
						</td>
						<td class="px-4 py-3">{item.assignee?.name ?? '–'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
