<script lang="ts">
	import { resolve } from '$app/paths';
	import CompanyForm from '$lib/components/CompanyForm.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head><title>{data.company.name} bearbeiten – Corvion Tool</title></svelte:head>

<nav aria-label="Pfad" class="text-sm text-secondary">
	<a href={resolve('/firmen')} class="hover:underline">Firmen</a>
	<span aria-hidden="true"> / </span>
	<a href={resolve('/(app)/firmen/[id]', { id: data.company.id })} class="hover:underline">
		{data.company.name}
	</a>
	<span aria-hidden="true"> / </span>
	<span>Bearbeiten</span>
</nav>

<h1 class="mt-2 font-display text-2xl font-semibold">Firma bearbeiten</h1>

<div class="mt-6">
	<CompanyForm
		values={(form?.values as Record<string, string>) ?? {
			...data.company,
			hourlyRate: data.company.hourlyRateCents
				? (data.company.hourlyRateCents / 100).toFixed(2).replace('.', ',')
				: ''
		}}
		errors={form?.errors ?? {}}
		submitLabel="Änderungen speichern"
	/>
</div>
