<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { FileText, TriangleAlert } from 'lucide-svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
	const dateTime = new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' });

	function formatHours(hours: number): string {
		return hours.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	}
</script>

<svelte:head><title>Abrechnung – Corvion Tool</title></svelte:head>

<h1 class="font-display text-2xl font-semibold">Abrechnung</h1>
<p class="mt-1 text-sm text-secondary">
	Rechnungsentwürfe aus Pauschalen und Zeiten — festgeschrieben wird in lexoffice.
</p>

<div class="mt-4 flex flex-wrap items-end gap-6">
	<form method="get" class="flex items-end gap-3">
		<div>
			<label for="monat" class="block text-sm font-semibold">Abrechnungsmonat</label>
			<input
				id="monat"
				name="monat"
				type="month"
				value={data.month}
				class="mt-1 rounded-md border-border text-sm focus:border-accent focus:ring-accent"
			/>
		</div>
		<button
			type="submit"
			class="cursor-pointer rounded-md border border-border bg-white px-3 py-2 text-sm font-semibold transition-colors duration-150 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
		>
			Anzeigen
		</button>
	</form>

	<form method="post" action="?/setRate" use:enhance class="flex items-end gap-3">
		<div>
			<label for="hourlyRate" class="block text-sm font-semibold">Standard-Stundensatz (€ netto)</label>
			<input
				id="hourlyRate"
				name="hourlyRate"
				type="text"
				inputmode="decimal"
				value={(data.defaultRateCents / 100).toFixed(2).replace('.', ',')}
				class="mt-1 w-32 rounded-md border-border text-sm focus:border-accent focus:ring-accent"
			/>
		</div>
		<button
			type="submit"
			class="cursor-pointer rounded-md border border-border bg-white px-3 py-2 text-sm font-semibold transition-colors duration-150 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
		>
			Speichern
		</button>
		{#if form && 'rateError' in form && form.rateError}
			<p class="pb-2 text-sm text-destructive" role="alert">{form.rateError}</p>
		{/if}
	</form>
</div>

{#if !data.hasLexofficeKey}
	<div class="mt-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
		<TriangleAlert size={18} aria-hidden="true" class="mt-0.5 shrink-0 text-amber-700" />
		<p>
			<span class="font-semibold">lexoffice-API-Key fehlt</span> — die Vorschau funktioniert, aber
			Entwürfe können erst erzeugt werden, wenn <code class="rounded bg-muted px-1">LEXOFFICE_API_KEY</code>
			gesetzt ist (app.lexoffice.de → Extras → Public API).
		</p>
	</div>
{/if}

<h2 class="mt-8 font-display text-lg font-semibold">Offene Posten</h2>
{#if data.previews.length === 0}
	<div class="mt-3 rounded-lg border border-border bg-white p-8 text-center">
		<p class="font-semibold">Nichts abzurechnen in diesem Monat.</p>
	</div>
{:else}
	<div class="mt-3 space-y-4">
		{#each data.previews as preview (preview.company.id)}
			<article class="rounded-lg border {preview.missingLexofficeId ? 'border-destructive/50' : 'border-border'} bg-white p-5">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div>
						<h3 class="font-display text-lg font-semibold">
							<a href={resolve('/(app)/firmen/[id]', { id: preview.company.id })} class="hover:underline">
								{preview.company.name}
							</a>
						</h3>
						{#if preview.missingLexofficeId}
							<p class="mt-1 text-sm font-semibold text-destructive">
								lexoffice-Kontakt-ID fehlt — in der Firmen-Akte pflegen, sonst kein Entwurf möglich.
							</p>
						{/if}
					</div>
					<p class="font-display text-xl font-semibold">{euro.format(preview.totalNetCents / 100)} <span class="text-sm font-normal text-secondary">netto</span></p>
				</div>

				<dl class="mt-3 space-y-1 text-sm">
					{#each preview.contracts as { contract, note } (contract.id)}
						<div class="flex justify-between gap-4">
							<dt>{contract.title} (Pauschale)</dt>
							<dd class="font-semibold">{euro.format(contract.monthlyFeeCents / 100)}</dd>
						</div>
						{#if note}
							<p class="text-xs text-amber-800">{note}</p>
						{/if}
					{/each}
					{#if preview.totalMinutes > 0}
						<div class="flex justify-between gap-4">
							<dt>
								Aufwand: {formatHours(preview.hours)} h × {euro.format(preview.hourlyRateCents / 100)}
								<span class="text-secondary">({preview.timeEntries.length} Einträge, {preview.totalMinutes} min)</span>
							</dt>
							<dd class="font-semibold">{euro.format(preview.laborNetCents / 100)}</dd>
						</div>
					{/if}
				</dl>

				{#if form && 'runError' in form && form.runCompanyId === preview.company.id}
					<p class="mt-3 text-sm text-destructive" role="alert">{form.runError}</p>
				{/if}

				{#if !preview.missingLexofficeId && data.hasLexofficeKey}
					<form method="post" action="?/createRun" use:enhance class="mt-4">
						<input type="hidden" name="companyId" value={preview.company.id} />
						<input type="hidden" name="month" value={data.month} />
						<button
							type="submit"
							class="flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-colors duration-150 hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
						>
							<FileText size={16} aria-hidden="true" />
							Entwurf in lexoffice erzeugen
						</button>
					</form>
				{/if}
			</article>
		{/each}
	</div>
{/if}

<h2 class="mt-8 font-display text-lg font-semibold">Läufe im {data.month}</h2>
{#if data.runs.length === 0}
	<p class="mt-3 text-sm text-secondary">Noch keine Entwürfe erzeugt.</p>
{:else}
	<div class="mt-3 overflow-x-auto rounded-lg border border-border bg-white">
		<table class="w-full text-left text-sm">
			<thead class="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-secondary">
				<tr>
					<th scope="col" class="px-4 py-3">Firma</th>
					<th scope="col" class="px-4 py-3">Erzeugt</th>
					<th scope="col" class="px-4 py-3">Summe netto</th>
					<th scope="col" class="px-4 py-3"><span class="sr-only">Aktion</span></th>
				</tr>
			</thead>
			<tbody>
				{#each data.runs as run (run.id)}
					<tr class="border-b border-border last:border-b-0">
						<td class="px-4 py-3 font-semibold">{run.companyName}</td>
						<td class="px-4 py-3">{dateTime.format(run.createdAt)}</td>
						<td class="px-4 py-3">{euro.format(run.totalNetCents / 100)}</td>
						<td class="px-4 py-3">
							<form
								method="post"
								action="?/discardRun"
								use:enhance={({ cancel }) => {
									if (
										!confirm(
											`Lauf für ${run.companyName} verwerfen? Die Zeiten werden wieder abrechenbar — den Entwurf in lexoffice bitte selbst löschen.`
										)
									) {
										cancel();
									}
								}}
							>
								<input type="hidden" name="runId" value={run.id} />
								<button type="submit" class="cursor-pointer text-xs font-semibold text-destructive hover:underline">
									Verwerfen
								</button>
							</form>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
