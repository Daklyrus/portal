<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { LogOut } from 'lucide-svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	const nav = [
		{ href: resolve('/portal'), label: 'Übersicht', exact: true },
		{ href: resolve('/portal/tickets'), label: 'Anfragen', exact: false },
		{ href: resolve('/portal/rechnungen'), label: 'Rechnungen', exact: false },
		{ href: resolve('/portal/vertraege'), label: 'Verträge', exact: false },
		{ href: resolve('/portal/dokumente'), label: 'Dokumente', exact: false },
		{ href: resolve('/portal/einstellungen'), label: 'Einstellungen', exact: false }
	];

	function isActive(href: string, exact: boolean): boolean {
		return exact ? page.url.pathname === href : page.url.pathname.startsWith(href);
	}
</script>

<div class="flex min-h-screen flex-col">
	<header class="border-b border-border bg-primary text-on-primary">
		<div class="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
			<div>
				<p class="font-display text-lg font-semibold">Corvion Portal</p>
				<p class="text-xs text-slate-300">{data.portal.companyName}</p>
			</div>
			<div class="flex items-center gap-4">
				<span class="text-sm text-slate-300">{data.user.name}</span>
				<form method="post" action="/logout">
					<button
						type="submit"
						class="flex cursor-pointer items-center gap-2 rounded-md border border-secondary px-3 py-1.5 text-sm font-semibold text-slate-200 transition-colors duration-150 hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring"
					>
						<LogOut size={14} aria-hidden="true" />
						Abmelden
					</button>
				</form>
			</div>
		</div>
		<nav class="mx-auto max-w-4xl px-4" aria-label="Portal-Navigation">
			<ul class="flex flex-wrap gap-1">
				{#each nav as item (item.href)}
					<li>
						<a
							href={item.href}
							aria-current={isActive(item.href, item.exact) ? 'page' : undefined}
							class={[
								'inline-block rounded-t-md px-3 py-2 text-sm font-semibold transition-colors duration-150',
								isActive(item.href, item.exact)
									? 'bg-background text-primary'
									: 'text-slate-300 hover:bg-secondary hover:text-on-primary'
							]}
						>
							{item.label}
						</a>
					</li>
				{/each}
			</ul>
		</nav>
	</header>
	<main class="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
		{@render children()}
	</main>
	<footer class="border-t border-border py-4 text-center text-xs text-secondary">
		Corvion · <a href="mailto:support@corvion.de" class="hover:underline">support@corvion.de</a>
	</footer>
</div>
