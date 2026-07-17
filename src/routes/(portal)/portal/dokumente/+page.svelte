<script lang="ts">
	import { resolve } from '$app/paths';
	import { Download } from 'lucide-svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const dateFormat = new Intl.DateTimeFormat('de-DE');

	function formatBytes(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
		return `${(bytes / 1024 / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB`;
	}
</script>

<svelte:head><title>Dokumente – Corvion Portal</title></svelte:head>

<h1 class="font-display text-2xl font-semibold">Dokumente</h1>
<p class="mt-1 text-sm text-secondary">Von Corvion für Sie freigegebene Unterlagen.</p>

{#if data.documents.length === 0}
	<div class="mt-8 rounded-lg border border-border bg-white p-8 text-center">
		<p class="font-semibold">Keine freigegebenen Dokumente.</p>
	</div>
{:else}
	<div class="mt-6 overflow-x-auto rounded-lg border border-border bg-white">
		<table class="w-full text-left text-sm">
			<thead class="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-secondary">
				<tr>
					<th scope="col" class="px-4 py-3">Datei</th>
					<th scope="col" class="px-4 py-3">Größe</th>
					<th scope="col" class="px-4 py-3">Datum</th>
					<th scope="col" class="px-4 py-3"><span class="sr-only">Download</span></th>
				</tr>
			</thead>
			<tbody>
				{#each data.documents as document (document.id)}
					<tr class="border-b border-border last:border-b-0">
						<td class="px-4 py-3 font-semibold">{document.fileName}</td>
						<td class="px-4 py-3">{formatBytes(document.sizeBytes)}</td>
						<td class="px-4 py-3">{dateFormat.format(document.createdAt)}</td>
						<td class="px-4 py-3">
							<a
								href={resolve('/(portal)/portal/dokumente/[docId]', { docId: document.id })}
								class="flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
							>
								<Download size={14} aria-hidden="true" />
								Herunterladen
							</a>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
