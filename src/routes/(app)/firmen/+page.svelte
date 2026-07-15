<script lang="ts">
	import { resolve } from '$app/paths';
	import { Plus, Search } from 'lucide-svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Firmen – Corvion Tool</title></svelte:head>

<div class="flex items-center justify-between gap-4">
	<h1 class="font-display text-2xl font-semibold">Firmen</h1>
	<a
		href={resolve('/firmen/neu')}
		class="flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-colors duration-150 hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
	>
		<Plus size={16} aria-hidden="true" />
		Neue Firma
	</a>
</div>

<form method="get" class="mt-4 max-w-sm">
	<label for="q" class="sr-only">Suchen</label>
	<div class="relative">
		<Search
			size={16}
			aria-hidden="true"
			class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-secondary"
		/>
		<input
			id="q"
			name="q"
			type="search"
			placeholder="Name oder Kundennummer"
			value={data.q}
			class="w-full rounded-md border-border pl-9 focus:border-accent focus:ring-accent"
		/>
	</div>
</form>

{#if data.companies.length === 0}
	<div class="mt-8 rounded-lg border border-border bg-white p-8 text-center">
		<p class="font-semibold">Keine Firmen gefunden.</p>
		<p class="mt-1 text-sm text-secondary">
			{data.q ? 'Suche anpassen oder neue Firma anlegen.' : 'Lege die erste Firma an.'}
		</p>
	</div>
{:else}
	<div class="mt-6 overflow-x-auto rounded-lg border border-border bg-white">
		<table class="w-full text-left text-sm">
			<thead class="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-secondary">
				<tr>
					<th scope="col" class="px-4 py-3">Name</th>
					<th scope="col" class="px-4 py-3">Kundennummer</th>
					<th scope="col" class="px-4 py-3">Ort</th>
					<th scope="col" class="px-4 py-3">E-Mail</th>
				</tr>
			</thead>
			<tbody>
				{#each data.companies as company (company.id)}
					<tr class="border-b border-border last:border-b-0 hover:bg-muted/40">
						<td class="px-4 py-3">
							<a
								href={resolve('/(app)/firmen/[id]', { id: company.id })}
								class="font-semibold text-accent hover:underline"
							>
								{company.name}
							</a>
						</td>
						<td class="px-4 py-3">{company.customerNumber ?? '–'}</td>
						<td class="px-4 py-3">{company.city ?? '–'}</td>
						<td class="px-4 py-3">{company.email ?? '–'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
