<script lang="ts">
	import { enhance } from '$app/forms';

	interface Props {
		action: string;
		contactId?: string;
		values?: Record<string, string | null | undefined>;
		errors?: Record<string, string[] | undefined>;
		submitLabel: string;
		oncancel: () => void;
	}

	let { action, contactId, values = {}, errors = {}, submitLabel, oncancel }: Props = $props();

	const fields = [
		{ name: 'firstName', label: 'Vorname', required: true },
		{ name: 'lastName', label: 'Nachname', required: true },
		{ name: 'position', label: 'Position', required: false },
		{ name: 'email', label: 'E-Mail', required: false, type: 'email' },
		{ name: 'phone', label: 'Telefon', required: false },
		{ name: 'mobile', label: 'Mobil', required: false }
	] as const;
</script>

<form method="post" {action} use:enhance class="rounded-lg border border-border bg-muted/40 p-4">
	{#if contactId}
		<input type="hidden" name="contactId" value={contactId} />
	{/if}
	<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
		{#each fields as field (field.name)}
			<div>
				<label for="{field.name}-{contactId ?? 'neu'}" class="block text-sm font-semibold">
					{field.label}{#if field.required}<span class="text-destructive"> *</span>{/if}
				</label>
				<input
					id="{field.name}-{contactId ?? 'neu'}"
					name={field.name}
					type={'type' in field ? field.type : 'text'}
					required={field.required}
					value={values[field.name] ?? ''}
					class="mt-1 w-full rounded-md border-border focus:border-accent focus:ring-accent"
					aria-invalid={errors[field.name] ? 'true' : undefined}
				/>
				{#if errors[field.name]}
					<p class="mt-1 text-sm text-destructive" role="alert">{errors[field.name]?.[0]}</p>
				{/if}
			</div>
		{/each}
		<div class="sm:col-span-2">
			<label for="notes-{contactId ?? 'neu'}" class="block text-sm font-semibold">Notizen</label>
			<textarea
				id="notes-{contactId ?? 'neu'}"
				name="notes"
				rows="2"
				class="mt-1 w-full rounded-md border-border focus:border-accent focus:ring-accent"
				>{values.notes ?? ''}</textarea
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
