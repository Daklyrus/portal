<script lang="ts">
	import { resolve } from '$app/paths';
	import { Plus } from 'lucide-svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Übersicht – Corvion Portal</title></svelte:head>

<h1 class="font-display text-2xl font-semibold">Willkommen, {data.user.name}</h1>

<div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
	<a
		href={resolve('/portal/tickets')}
		class="rounded-lg border border-border bg-white p-5 transition-colors duration-150 hover:border-accent"
	>
		<p class="text-xs font-semibold uppercase tracking-wide text-secondary">Offene Anfragen</p>
		<p class="mt-1 font-display text-3xl font-semibold">{data.openTicketCount}</p>
	</a>
	<a
		href={resolve('/portal/rechnungen')}
		class="rounded-lg border border-border bg-white p-5 transition-colors duration-150 hover:border-accent"
	>
		<p class="text-xs font-semibold uppercase tracking-wide text-secondary">Offene Rechnungen</p>
		<p class="mt-1 font-display text-3xl font-semibold">{data.openInvoiceCount}</p>
	</a>
</div>

<a
	href={resolve('/portal/tickets/neu')}
	class="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 font-semibold text-on-primary transition-colors duration-150 hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
>
	<Plus size={16} aria-hidden="true" />
	Neue Anfrage stellen
</a>
