<script lang="ts">
	import { resolve } from '$app/paths';
	import CompanyForm from '$lib/components/CompanyForm.svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<svelte:head><title>Neue Firma – Corvion Tool</title></svelte:head>

<nav aria-label="Pfad" class="text-sm text-secondary">
	<a href={resolve('/firmen')} class="hover:underline">Firmen</a>
	<span aria-hidden="true"> / </span>
	<span>Neue Firma</span>
</nav>

<h1 class="mt-2 font-display text-2xl font-semibold">Neue Firma</h1>

<div class="mt-6">
	<CompanyForm
		values={(form?.values as Record<string, string>) ?? {}}
		errors={form?.errors ?? {}}
		submitLabel="Firma anlegen"
	/>
</div>
