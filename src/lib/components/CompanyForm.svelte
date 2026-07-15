<script lang="ts">
	import { enhance } from '$app/forms';

	interface Props {
		values?: Record<string, string | null | undefined>;
		errors?: Record<string, string[] | undefined>;
		submitLabel: string;
	}

	let { values = {}, errors = {}, submitLabel }: Props = $props();

	const fields = [
		{ name: 'name', label: 'Name', required: true, colSpan: 2 },
		{ name: 'customerNumber', label: 'Kundennummer', required: false, colSpan: 1 },
		{ name: 'email', label: 'E-Mail', required: false, colSpan: 1, type: 'email' },
		{ name: 'phone', label: 'Telefon', required: false, colSpan: 1 },
		{ name: 'website', label: 'Website', required: false, colSpan: 1 },
		{ name: 'street', label: 'Straße und Hausnummer', required: false, colSpan: 2 },
		{ name: 'zip', label: 'PLZ', required: false, colSpan: 1 },
		{ name: 'city', label: 'Ort', required: false, colSpan: 1 }
	] as const;
</script>

<form method="post" use:enhance class="max-w-2xl">
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		{#each fields as field (field.name)}
			<div class={field.colSpan === 2 ? 'sm:col-span-2' : ''}>
				<label for={field.name} class="block text-sm font-semibold">
					{field.label}{#if field.required}<span class="text-destructive"> *</span>{/if}
				</label>
				<input
					id={field.name}
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
			<label for="notes" class="block text-sm font-semibold">Notizen</label>
			<textarea
				id="notes"
				name="notes"
				rows="3"
				class="mt-1 w-full rounded-md border-border focus:border-accent focus:ring-accent"
				>{values.notes ?? ''}</textarea
			>
		</div>
	</div>
	<div class="mt-6">
		<button
			type="submit"
			class="cursor-pointer rounded-md bg-primary px-4 py-2 font-semibold text-on-primary transition-colors duration-150 hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
		>
			{submitLabel}
		</button>
	</div>
</form>
