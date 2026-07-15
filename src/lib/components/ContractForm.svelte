<script lang="ts">
	import { enhance } from '$app/forms';

	interface Props {
		action: string;
		contractId?: string;
		values?: Record<string, string | null | undefined>;
		errors?: Record<string, string[] | undefined>;
		submitLabel: string;
		oncancel: () => void;
	}

	let { action, contractId, values = {}, errors = {}, submitLabel, oncancel }: Props = $props();

	const statusOptions = [
		{ value: 'draft', label: 'Entwurf' },
		{ value: 'active', label: 'Aktiv' },
		{ value: 'cancelled', label: 'Gekündigt' },
		{ value: 'ended', label: 'Beendet' }
	];

	const suffix = $derived(contractId ?? 'neu');
</script>

{#snippet fieldError(name: string)}
	{#if errors[name]}
		<p class="mt-1 text-sm text-destructive" role="alert">{errors[name]?.[0]}</p>
	{/if}
{/snippet}

<form method="post" {action} use:enhance class="rounded-lg border border-border bg-muted/40 p-4">
	{#if contractId}
		<input type="hidden" name="contractId" value={contractId} />
	{/if}
	<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
		<div class="sm:col-span-2">
			<label for="title-{suffix}" class="block text-sm font-semibold">
				Titel<span class="text-destructive"> *</span>
			</label>
			<input
				id="title-{suffix}"
				name="title"
				type="text"
				required
				value={values.title ?? ''}
				class="mt-1 w-full rounded-md border-border focus:border-accent focus:ring-accent"
			/>
			{@render fieldError('title')}
		</div>
		<div>
			<label for="status-{suffix}" class="block text-sm font-semibold">Status</label>
			<select
				id="status-{suffix}"
				name="status"
				class="mt-1 w-full rounded-md border-border focus:border-accent focus:ring-accent"
			>
				{#each statusOptions as option (option.value)}
					<option value={option.value} selected={(values.status ?? 'active') === option.value}>
						{option.label}
					</option>
				{/each}
			</select>
		</div>
		<div>
			<label for="startDate-{suffix}" class="block text-sm font-semibold">
				Vertragsbeginn<span class="text-destructive"> *</span>
			</label>
			<input
				id="startDate-{suffix}"
				name="startDate"
				type="date"
				required
				value={values.startDate ?? ''}
				class="mt-1 w-full rounded-md border-border focus:border-accent focus:ring-accent"
			/>
			{@render fieldError('startDate')}
		</div>
		<div>
			<label for="initialTermMonths-{suffix}" class="block text-sm font-semibold">
				Laufzeit (Monate)
			</label>
			<input
				id="initialTermMonths-{suffix}"
				name="initialTermMonths"
				type="number"
				min="0"
				value={values.initialTermMonths ?? '12'}
				class="mt-1 w-full rounded-md border-border focus:border-accent focus:ring-accent"
			/>
			{@render fieldError('initialTermMonths')}
		</div>
		<div>
			<label for="renewalTermMonths-{suffix}" class="block text-sm font-semibold">
				Verlängerung (Monate, 0 = läuft aus)
			</label>
			<input
				id="renewalTermMonths-{suffix}"
				name="renewalTermMonths"
				type="number"
				min="0"
				value={values.renewalTermMonths ?? '12'}
				class="mt-1 w-full rounded-md border-border focus:border-accent focus:ring-accent"
			/>
			{@render fieldError('renewalTermMonths')}
		</div>
		<div>
			<label for="noticePeriodMonths-{suffix}" class="block text-sm font-semibold">
				Kündigungsfrist (Monate)
			</label>
			<input
				id="noticePeriodMonths-{suffix}"
				name="noticePeriodMonths"
				type="number"
				min="0"
				value={values.noticePeriodMonths ?? '3'}
				class="mt-1 w-full rounded-md border-border focus:border-accent focus:ring-accent"
			/>
			{@render fieldError('noticePeriodMonths')}
		</div>
		<div>
			<label for="monthlyFee-{suffix}" class="block text-sm font-semibold">
				Monatliche Pauschale (€)
			</label>
			<input
				id="monthlyFee-{suffix}"
				name="monthlyFee"
				type="text"
				inputmode="decimal"
				placeholder="z. B. 499,00"
				value={values.monthlyFee ?? ''}
				class="mt-1 w-full rounded-md border-border focus:border-accent focus:ring-accent"
			/>
			{@render fieldError('monthlyFee')}
		</div>
		<div class="sm:col-span-2">
			<label for="includedServices-{suffix}" class="block text-sm font-semibold">
				Enthaltene Leistungen
			</label>
			<textarea
				id="includedServices-{suffix}"
				name="includedServices"
				rows="3"
				placeholder="z. B. Monitoring, Patch-Management, 8×5-Support"
				class="mt-1 w-full rounded-md border-border focus:border-accent focus:ring-accent"
				>{values.includedServices ?? ''}</textarea
			>
		</div>
		<div class="sm:col-span-2">
			<label for="description-{suffix}" class="block text-sm font-semibold">Beschreibung</label>
			<textarea
				id="description-{suffix}"
				name="description"
				rows="2"
				class="mt-1 w-full rounded-md border-border focus:border-accent focus:ring-accent"
				>{values.description ?? ''}</textarea
			>
		</div>
	</div>
	<div class="mt-4 flex gap-2">
		<button
			type="submit"
			class="cursor-pointer rounded-md bg-primary px-3 py-2 text-sm font-semibold text-on-primary transition-colors duration-150 hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
		>
			{submitLabel}
		</button>
		<button
			type="button"
			onclick={oncancel}
			class="cursor-pointer rounded-md border border-border bg-white px-3 py-2 text-sm font-semibold transition-colors duration-150 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
		>
			Abbrechen
		</button>
	</div>
</form>
