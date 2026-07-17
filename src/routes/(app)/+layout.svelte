<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { LayoutDashboard, Building2, Ticket, BarChart3, Receipt, ShieldCheck, LogOut } from 'lucide-svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	const nav = [
		{ href: resolve('/'), label: 'Dashboard', icon: LayoutDashboard, exact: true },
		{ href: resolve('/tickets'), label: 'Tickets', icon: Ticket, exact: false },
		{ href: resolve('/firmen'), label: 'Firmen', icon: Building2, exact: false },
		{ href: resolve('/berichte/zeiten'), label: 'Berichte', icon: BarChart3, exact: false },
		{ href: resolve('/abrechnung'), label: 'Abrechnung', icon: Receipt, exact: false }
	];

	function isActive(href: string, exact: boolean): boolean {
		return exact ? page.url.pathname === href : page.url.pathname.startsWith(href);
	}
</script>

<div class="flex min-h-screen">
	<aside class="flex w-56 shrink-0 flex-col border-r border-border bg-primary text-on-primary">
		<a href={resolve('/')} class="px-4 py-4 font-display text-lg font-semibold">Corvion</a>
		<nav class="flex-1 space-y-1 px-2" aria-label="Hauptnavigation">
			{#each nav as item (item.href)}
				{@const Icon = item.icon}
				<a
					href={item.href}
					aria-current={isActive(item.href, item.exact) ? 'page' : undefined}
					class={[
						'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition-colors duration-150',
						isActive(item.href, item.exact)
							? 'bg-accent text-on-primary'
							: 'text-slate-300 hover:bg-secondary hover:text-on-primary'
					]}
				>
					<Icon size={16} aria-hidden="true" />
					{item.label}
				</a>
			{/each}
		</nav>
		<div class="border-t border-secondary px-2 py-3">
			<a
				href={resolve('/einstellungen/sicherheit')}
				class="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold text-slate-300 transition-colors duration-150 hover:bg-secondary hover:text-on-primary"
			>
				<ShieldCheck size={16} aria-hidden="true" />
				Sicherheit
			</a>
			<form method="post" action="/logout">
				<button
					type="submit"
					class="flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold text-slate-300 transition-colors duration-150 hover:bg-secondary hover:text-on-primary focus:outline-none focus:ring-2 focus:ring-ring"
				>
					<LogOut size={16} aria-hidden="true" />
					Abmelden
				</button>
			</form>
			<p class="px-3 pt-2 text-xs text-slate-400">{data.user.name}</p>
		</div>
	</aside>
	<main class="min-w-0 flex-1 px-6 py-6">
		<div class="mx-auto max-w-5xl">
			{@render children()}
		</div>
	</main>
</div>
