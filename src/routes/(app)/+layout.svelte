<script lang="ts">
	import { resolve } from '$app/paths';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();
</script>

<div class="min-h-screen">
	<header class="border-b border-border bg-white">
		<div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
			<a href={resolve('/')} class="font-display text-lg font-semibold text-primary">Corvion Tool</a>
			<div class="flex items-center gap-4">
				<span class="text-sm text-secondary">{data.user.name}</span>
				<form method="post" action="/logout">
					<button
						type="submit"
						class="cursor-pointer rounded-md border border-border px-3 py-1.5 text-sm font-semibold transition-colors duration-150 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
					>
						Abmelden
					</button>
				</form>
			</div>
		</div>
	</header>
	<main class="mx-auto max-w-6xl px-4 py-6">
		{@render children()}
	</main>
</div>
