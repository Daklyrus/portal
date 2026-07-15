<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { Pencil, Plus, Star, Trash2 } from 'lucide-svelte';
	import ContactForm from '$lib/components/ContactForm.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let company = $derived(data.company);

	const address = $derived(
		[company.street, [company.zip, company.city].filter(Boolean).join(' ')]
			.filter(Boolean)
			.join(', ')
	);

	// 'new', eine Kontakt-ID oder null. Beschreibbares $derived: Klicks überschreiben,
	// Action-Ergebnisse (Fehler → offen lassen, gespeichert → schließen) setzen zurück.
	let editing = $derived.by<string | null>(() => {
		if (form && 'editing' in form && typeof form.editing === 'string') return form.editing;
		return null;
	});

	let contactErrors = $derived(form && 'contactErrors' in form ? form.contactErrors : {});
	let contactValues = $derived(
		form && 'contactValues' in form ? (form.contactValues as Record<string, string>) : undefined
	);
</script>

<svelte:head><title>{company.name} – Corvion Tool</title></svelte:head>

<nav aria-label="Pfad" class="text-sm text-secondary">
	<a href={resolve('/firmen')} class="hover:underline">Firmen</a>
	<span aria-hidden="true"> / </span>
	<span>{company.name}</span>
</nav>

<div class="mt-2 flex items-start justify-between gap-4">
	<div>
		<h1 class="font-display text-2xl font-semibold">{company.name}</h1>
		{#if company.customerNumber}
			<p class="mt-1 text-sm text-secondary">Kundennummer {company.customerNumber}</p>
		{/if}
	</div>
	<div class="flex shrink-0 gap-2">
		<a
			href={resolve('/(app)/firmen/[id]/bearbeiten', { id: company.id })}
			class="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm font-semibold transition-colors duration-150 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
		>
			<Pencil size={16} aria-hidden="true" />
			Bearbeiten
		</a>
		<form
			method="post"
			action="?/delete"
			use:enhance={({ cancel }) => {
				if (!confirm('Firma und alle zugehörigen Kontakte, Verträge und Dokumente löschen?')) {
					cancel();
				}
			}}
		>
			<button
				type="submit"
				class="flex cursor-pointer items-center gap-2 rounded-md border border-destructive px-3 py-2 text-sm font-semibold text-destructive transition-colors duration-150 hover:bg-destructive hover:text-on-primary focus:outline-none focus:ring-2 focus:ring-destructive"
			>
				<Trash2 size={16} aria-hidden="true" />
				Löschen
			</button>
		</form>
	</div>
</div>

<section class="mt-6 rounded-lg border border-border bg-white p-6">
	<h2 class="font-display text-lg font-semibold">Stammdaten</h2>
	<dl class="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
		<div>
			<dt class="font-semibold text-secondary">Adresse</dt>
			<dd class="mt-0.5">{address || '–'}</dd>
		</div>
		<div>
			<dt class="font-semibold text-secondary">E-Mail</dt>
			<dd class="mt-0.5">
				{#if company.email}<a href="mailto:{company.email}" class="text-accent hover:underline">{company.email}</a>{:else}–{/if}
			</dd>
		</div>
		<div>
			<dt class="font-semibold text-secondary">Telefon</dt>
			<dd class="mt-0.5">{company.phone ?? '–'}</dd>
		</div>
		<div>
			<dt class="font-semibold text-secondary">Website</dt>
			<dd class="mt-0.5">{company.website ?? '–'}</dd>
		</div>
		{#if company.notes}
			<div class="sm:col-span-2">
				<dt class="font-semibold text-secondary">Notizen</dt>
				<dd class="mt-0.5 whitespace-pre-line">{company.notes}</dd>
			</div>
		{/if}
	</dl>
</section>

<section class="mt-6 rounded-lg border border-border bg-white p-6">
	<div class="flex items-center justify-between gap-4">
		<h2 class="font-display text-lg font-semibold">Ansprechpartner</h2>
		{#if editing !== 'new'}
			<button
				type="button"
				onclick={() => (editing = 'new')}
				class="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm font-semibold transition-colors duration-150 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
			>
				<Plus size={16} aria-hidden="true" />
				Neuer Ansprechpartner
			</button>
		{/if}
	</div>

	{#if editing === 'new'}
		<div class="mt-4">
			<ContactForm
				action="?/createContact"
				values={contactValues}
				errors={contactErrors}
				submitLabel="Ansprechpartner anlegen"
				oncancel={() => (editing = null)}
			/>
		</div>
	{/if}

	{#if data.contacts.length === 0 && editing !== 'new'}
		<p class="mt-4 text-sm text-secondary">Noch keine Ansprechpartner hinterlegt.</p>
	{:else}
		<ul class="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
			{#each data.contacts as contact (contact.id)}
				<li class="rounded-lg border border-border p-4">
					{#if editing === contact.id}
						<ContactForm
							action="?/updateContact"
							contactId={contact.id}
							values={contactValues ?? {
								firstName: contact.firstName,
								lastName: contact.lastName,
								position: contact.position,
								email: contact.email,
								phone: contact.phone,
								mobile: contact.mobile,
								notes: contact.notes
							}}
							errors={contactErrors}
							submitLabel="Änderungen speichern"
							oncancel={() => (editing = null)}
						/>
					{:else}
						<div class="flex items-start justify-between gap-2">
							<div>
								<p class="font-semibold">
									{contact.firstName}
									{contact.lastName}
									{#if contact.isPrimary}
										<span
											class="ml-1 inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent"
										>
											<Star size={12} aria-hidden="true" />
											Hauptkontakt
										</span>
									{/if}
								</p>
								{#if contact.position}
									<p class="text-sm text-secondary">{contact.position}</p>
								{/if}
							</div>
						</div>
						<dl class="mt-2 space-y-1 text-sm">
							{#if contact.email}
								<div>
									<dt class="sr-only">E-Mail</dt>
									<dd><a href="mailto:{contact.email}" class="text-accent hover:underline">{contact.email}</a></dd>
								</div>
							{/if}
							{#if contact.phone}
								<div><dt class="sr-only">Telefon</dt><dd>{contact.phone}</dd></div>
							{/if}
							{#if contact.mobile}
								<div><dt class="sr-only">Mobil</dt><dd>{contact.mobile} (mobil)</dd></div>
							{/if}
							{#if contact.notes}
								<div><dt class="sr-only">Notizen</dt><dd class="text-secondary">{contact.notes}</dd></div>
							{/if}
						</dl>
						<div class="mt-3 flex flex-wrap gap-2 text-sm">
							{#if !contact.isPrimary}
								<form method="post" action="?/setPrimary" use:enhance>
									<input type="hidden" name="contactId" value={contact.id} />
									<button type="submit" class="cursor-pointer font-semibold text-accent hover:underline">
										Als Hauptkontakt setzen
									</button>
								</form>
							{/if}
							<button
								type="button"
								onclick={() => (editing = contact.id)}
								class="cursor-pointer font-semibold text-secondary hover:underline"
							>
								Bearbeiten
							</button>
							<form
								method="post"
								action="?/deleteContact"
								use:enhance={({ cancel }) => {
									if (!confirm(`${contact.firstName} ${contact.lastName} löschen?`)) cancel();
								}}
							>
								<input type="hidden" name="contactId" value={contact.id} />
								<button type="submit" class="cursor-pointer font-semibold text-destructive hover:underline">
									Löschen
								</button>
							</form>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>
