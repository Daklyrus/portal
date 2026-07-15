<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Dashboard – Corvion Tool</title></svelte:head>

<h1 class="font-display text-2xl font-semibold">Dashboard</h1>
<p class="mt-2 text-secondary">Angemeldet als {data.user.name}.</p>
