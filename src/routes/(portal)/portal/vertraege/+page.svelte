<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
	const dateFormat = new Intl.DateTimeFormat('de-DE');
</script>

<svelte:head><title>Verträge – Corvion Portal</title></svelte:head>

<h1 class="font-display text-2xl font-semibold">Verträge</h1>

{#if data.contracts.length === 0}
	<div class="mt-8 rounded-lg border border-border bg-white p-8 text-center">
		<p class="font-semibold">Keine freigegebenen Verträge.</p>
		<p class="mt-1 text-sm text-secondary">Bei Fragen zu Ihren Verträgen: support@corvion.de</p>
	</div>
{:else}
	<div class="mt-6 space-y-4">
		{#each data.contracts as { contract, renewsAt } (contract.id)}
			<article class="rounded-lg border border-border bg-white p-5">
				<h2 class="font-display text-lg font-semibold">{contract.title}</h2>
				<dl class="mt-3 grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
					<div>
						<dt class="font-semibold text-secondary">Läuft seit</dt>
						<dd>{dateFormat.format(new Date(contract.startDate))}</dd>
					</div>
					{#if renewsAt}
						<div>
							<dt class="font-semibold text-secondary">Nächste Verlängerung</dt>
							<dd>{dateFormat.format(new Date(renewsAt))} (um {contract.renewalTermMonths} Monate)</dd>
						</div>
					{/if}
					<div>
						<dt class="font-semibold text-secondary">Kündigungsfrist</dt>
						<dd>{contract.noticePeriodMonths} Monate zum Laufzeitende</dd>
					</div>
					<div>
						<dt class="font-semibold text-secondary">Monatliche Pauschale</dt>
						<dd>{euro.format(contract.monthlyFeeCents / 100)}</dd>
					</div>
					{#if contract.includedServices}
						<div class="sm:col-span-2">
							<dt class="font-semibold text-secondary">Enthaltene Leistungen</dt>
							<dd class="whitespace-pre-line">{contract.includedServices}</dd>
						</div>
					{/if}
				</dl>
			</article>
		{/each}
	</div>
{/if}
