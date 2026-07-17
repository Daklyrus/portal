<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function formatMinutes(minutes: number): string {
		return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')} h`;
	}
</script>

<svelte:head><title>Zeiten-Report – Corvion Tool</title></svelte:head>

<h1 class="font-display text-2xl font-semibold">Zeiten je Firma</h1>
<p class="mt-1 text-sm text-secondary">Abrechnungsgrundlage für lexoffice — Firma und Monat wählen.</p>

<form method="get" class="mt-4 flex flex-wrap items-end gap-3">
	<div>
		<label for="firma" class="block text-sm font-semibold">Firma</label>
		<select id="firma" name="firma" required class="mt-1 rounded-md border-border text-sm focus:border-accent focus:ring-accent">
			<option value="">– wählen –</option>
			{#each data.companies as company (company.id)}
				<option value={company.id} selected={data.companyId === company.id}>{company.name}</option>
			{/each}
		</select>
	</div>
	<div>
		<label for="monat" class="block text-sm font-semibold">Monat</label>
		<input
			id="monat"
			name="monat"
			type="month"
			value={data.month}
			required
			class="mt-1 rounded-md border-border text-sm focus:border-accent focus:ring-accent"
		/>
	</div>
	<button
		type="submit"
		class="cursor-pointer rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-colors duration-150 hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
	>
		Anzeigen
	</button>
</form>

{#if data.report}
	{#if data.report.entries.length === 0}
		<div class="mt-6 rounded-lg border border-border bg-white p-8 text-center">
			<p class="font-semibold">Keine Zeiteinträge in diesem Monat.</p>
		</div>
	{:else}
		<div class="mt-6 grid max-w-md grid-cols-2 gap-4">
			<div class="rounded-lg border border-border bg-white p-4">
				<p class="text-xs font-semibold uppercase tracking-wide text-secondary">Abrechenbar</p>
				<p class="mt-1 font-display text-2xl font-semibold">{formatMinutes(data.report.billableMinutes)}</p>
			</div>
			<div class="rounded-lg border border-border bg-white p-4">
				<p class="text-xs font-semibold uppercase tracking-wide text-secondary">Nicht abrechenbar</p>
				<p class="mt-1 font-display text-2xl font-semibold text-secondary">
					{formatMinutes(data.report.nonBillableMinutes)}
				</p>
			</div>
		</div>

		<div class="mt-4 overflow-x-auto rounded-lg border border-border bg-white">
			<table class="w-full text-left text-sm">
				<thead class="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-secondary">
					<tr>
						<th scope="col" class="px-4 py-3">Datum</th>
						<th scope="col" class="px-4 py-3">Ticket</th>
						<th scope="col" class="px-4 py-3">Notiz</th>
						<th scope="col" class="px-4 py-3">Wer</th>
						<th scope="col" class="px-4 py-3">Minuten</th>
						<th scope="col" class="px-4 py-3">Abrechenbar</th>
					</tr>
				</thead>
				<tbody>
					{#each data.report.entries as entry (entry.id)}
						<tr class="border-b border-border last:border-b-0">
							<td class="px-4 py-3">{new Date(entry.workDate).toLocaleDateString('de-DE')}</td>
							<td class="px-4 py-3">
								<a
									href={resolve('/(app)/tickets/[id]', { id: entry.ticketId })}
									class="font-semibold text-accent hover:underline"
								>
									T-{entry.ticketNumber}
								</a>
								<span class="text-secondary">{entry.ticketSubject}</span>
							</td>
							<td class="px-4 py-3">{entry.note ?? '–'}</td>
							<td class="px-4 py-3">{entry.userName ?? '–'}</td>
							<td class="px-4 py-3">{entry.minutes}</td>
							<td class="px-4 py-3">{entry.billable ? 'ja' : 'nein'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
{/if}
