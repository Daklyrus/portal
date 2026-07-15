<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { Pencil, Trash2 } from 'lucide-svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let company = $derived(data.company);

	const address = $derived(
		[company.street, [company.zip, company.city].filter(Boolean).join(' ')]
			.filter(Boolean)
			.join(', ')
	);
</script>

<svelte:head><title>{company.name} – Corvion Tool</title></svelte:head>

<nav aria-label="Pfad" class="text-sm text-secondary">
	<a href={resolve('/firmen')} class="hover:underline">Firmen</a>
	<span aria-hidden="true"> / </span>
	<span>{company.name}</span>
</nav>

<div class="mt-2 flex items-start justify-between gap-4">
	<div>
		<h1 class="font-display text-2xl font-semibold">{company.name}</h1>
		{#if company.customerNumber}
			<p class="mt-1 text-sm text-secondary">Kundennummer {company.customerNumber}</p>
		{/if}
	</div>
	<div class="flex shrink-0 gap-2">
		<a
			href={resolve('/(app)/firmen/[id]/bearbeiten', { id: company.id })}
			class="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm font-semibold transition-colors duration-150 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
		>
			<Pencil size={16} aria-hidden="true" />
			Bearbeiten
		</a>
		<form
			method="post"
			action="?/delete"
			use:enhance={({ cancel }) => {
				if (!confirm('Firma und alle zugehörigen Kontakte, Verträge und Dokumente löschen?')) {
					cancel();
				}
			}}
		>
			<button
				type="submit"
				class="flex cursor-pointer items-center gap-2 rounded-md border border-destructive px-3 py-2 text-sm font-semibold text-destructive transition-colors duration-150 hover:bg-destructive hover:text-on-primary focus:outline-none focus:ring-2 focus:ring-destructive"
			>
				<Trash2 size={16} aria-hidden="true" />
				Löschen
			</button>
		</form>
	</div>
</div>

<section class="mt-6 rounded-lg border border-border bg-white p-6">
	<h2 class="font-display text-lg font-semibold">Stammdaten</h2>
	<dl class="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
		<div>
			<dt class="font-semibold text-secondary">Adresse</dt>
			<dd class="mt-0.5">{address || '–'}</dd>
		</div>
		<div>
			<dt class="font-semibold text-secondary">E-Mail</dt>
			<dd class="mt-0.5">
				{#if company.email}<a href="mailto:{company.email}" class="text-accent hover:underline">{company.email}</a>{:else}–{/if}
			</dd>
		</div>
		<div>
			<dt class="font-semibold text-secondary">Telefon</dt>
			<dd class="mt-0.5">{company.phone ?? '–'}</dd>
		</div>
		<div>
			<dt class="font-semibold text-secondary">Website</dt>
			<dd class="mt-0.5">{company.website ?? '–'}</dd>
		</div>
		{#if company.notes}
			<div class="sm:col-span-2">
				<dt class="font-semibold text-secondary">Notizen</dt>
				<dd class="mt-0.5 whitespace-pre-line">{company.notes}</dd>
			</div>
		{/if}
	</dl>
</section>
