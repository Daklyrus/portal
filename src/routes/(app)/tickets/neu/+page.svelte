<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import RichTextEditor from '$lib/components/RichTextEditor.svelte';
	import { priorityOptions } from '$lib/tickets/labels';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let values = $derived((form?.values as Record<string, string>) ?? {});
	let errors = $derived(form?.errors ?? {});
</script>

<svelte:head><title>Neues Ticket – Corvion Tool</title></svelte:head>

<nav aria-label="Pfad" class="text-sm text-secondary">
	<a href={resolve('/tickets')} class="hover:underline">Tickets</a>
	<span aria-hidden="true"> / </span>
	<span>Neues Ticket</span>
</nav>

<h1 class="mt-2 font-display text-2xl font-semibold">Neues Ticket</h1>
<p class="mt-1 text-sm text-secondary">Für Anrufe, Vor-Ort-Termine oder proaktive Anliegen.</p>

<form method="post" use:enhance class="mt-6 max-w-2xl space-y-4">
	<div>
		<label for="subject" class="block text-sm font-semibold">
			Betreff<span class="text-destructive"> *</span>
		</label>
		<input
			id="subject"
			name="subject"
			type="text"
			required
			value={values.subject ?? ''}
			class="mt-1 w-full rounded-md border-border focus:border-accent focus:ring-accent"
		/>
		{#if errors.subject}<p class="mt-1 text-sm text-destructive" role="alert">{errors.subject[0]}</p>{/if}
	</div>

	<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
		<div>
			<label for="priority" class="block text-sm font-semibold">Priorität</label>
			<select id="priority" name="priority" class="mt-1 w-full rounded-md border-border focus:border-accent focus:ring-accent">
				{#each priorityOptions as option (option.value)}
					<option value={option.value} selected={(values.priority ?? 'normal') === option.value}>
						{option.label}
					</option>
				{/each}
			</select>
		</div>
		<div>
			<label for="companyId" class="block text-sm font-semibold">Firma</label>
			<select id="companyId" name="companyId" class="mt-1 w-full rounded-md border-border focus:border-accent focus:ring-accent">
				<option value="">– keine –</option>
				{#each data.companies as company (company.id)}
					<option value={company.id} selected={(values.companyId ?? data.selectedCompanyId) === company.id}>
						{company.name}
					</option>
				{/each}
			</select>
		</div>
		<div>
			<label for="contactId" class="block text-sm font-semibold">Ansprechpartner</label>
			<select id="contactId" name="contactId" class="mt-1 w-full rounded-md border-border focus:border-accent focus:ring-accent">
				<option value="">– keiner –</option>
				{#each data.contacts as contact (contact.id)}
					<option value={contact.id} selected={values.contactId === contact.id}>
						{contact.firstName} {contact.lastName}
					</option>
				{/each}
			</select>
		</div>
	</div>

	<div>
		<label for="description" class="block text-sm font-semibold">Interne Beschreibung</label>
		<textarea
			id="description"
			name="description"
			rows="3"
			placeholder="z. B. Telefonnotiz — landet als interne Notiz im Ticket"
			class="mt-1 w-full rounded-md border-border focus:border-accent focus:ring-accent"
			>{values.description ?? ''}</textarea
		>
	</div>

	<fieldset class="rounded-lg border border-border bg-muted/40 p-4">
		<legend class="px-1 text-sm font-semibold">Erst-Mail an den Kunden (optional)</legend>
		<div>
			<label for="to" class="block text-sm font-semibold">Empfänger</label>
			<input
				id="to"
				name="to"
				type="email"
				value={values.to ?? ''}
				placeholder="kunde@firma.de"
				class="mt-1 w-full rounded-md border-border focus:border-accent focus:ring-accent"
			/>
			{#if errors.to}<p class="mt-1 text-sm text-destructive" role="alert">{errors.to[0]}</p>{/if}
		</div>
		<div class="mt-3">
			<span class="block text-sm font-semibold">Nachricht</span>
			<div class="mt-1">
				<RichTextEditor name="initialMailHtml" initialHtml={values.initialMailHtml ?? ''} />
			</div>
		</div>
	</fieldset>

	<button
		type="submit"
		class="cursor-pointer rounded-md bg-primary px-4 py-2 font-semibold text-on-primary transition-colors duration-150 hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
	>
		Ticket anlegen
	</button>
</form>
