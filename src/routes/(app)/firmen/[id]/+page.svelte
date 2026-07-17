<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { Download, Pencil, Plus, Star, Trash2, Upload } from 'lucide-svelte';
	import ContactForm from '$lib/components/ContactForm.svelte';
	import ContractForm from '$lib/components/ContractForm.svelte';
	import DeadlineBadge from '$lib/components/DeadlineBadge.svelte';
	import type { ActionData, PageData } from './$types';

	const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

	function formatBytes(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
		return `${(bytes / 1024 / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB`;
	}
	const statusLabels: Record<string, string> = {
		draft: 'Entwurf',
		active: 'Aktiv',
		cancelled: 'Gekündigt',
		ended: 'Beendet'
	};
	const statusTones: Record<string, string> = {
		draft: 'bg-muted text-secondary',
		active: 'bg-emerald-100 text-emerald-800',
		cancelled: 'bg-destructive/10 text-destructive',
		ended: 'bg-muted text-secondary'
	};

	function contractToValues(contract: {
		title: string;
		description: string | null;
		status: string;
		startDate: string;
		initialTermMonths: number;
		renewalTermMonths: number;
		noticePeriodMonths: number;
		monthlyFeeCents: number;
		includedServices: string | null;
		sharedWithCustomer: boolean;
	}): Record<string, string | null> {
		return {
			title: contract.title,
			description: contract.description,
			status: contract.status,
			startDate: contract.startDate,
			initialTermMonths: String(contract.initialTermMonths),
			renewalTermMonths: String(contract.renewalTermMonths),
			noticePeriodMonths: String(contract.noticePeriodMonths),
			monthlyFee: (contract.monthlyFeeCents / 100).toFixed(2).replace('.', ','),
			includedServices: contract.includedServices,
			sharedWithCustomer: contract.sharedWithCustomer ? 'on' : ''
		};
	}

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

	let editingContract = $derived.by<string | null>(() => {
		if (form && 'editingContract' in form && typeof form.editingContract === 'string') {
			return form.editingContract;
		}
		return null;
	});
	let contractErrors = $derived(form && 'contractErrors' in form ? form.contractErrors : {});
	let contractValues = $derived(
		form && 'contractValues' in form ? (form.contractValues as Record<string, string>) : undefined
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
						{#if data.portalContactIds.includes(contact.id)}
							<p class="mt-2">
								<span class="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
									Portal-Zugang aktiv
								</span>
							</p>
						{/if}
						{#if form && 'portalError' in form && form.portalContactId === contact.id}
							<p class="mt-2 text-sm text-destructive" role="alert">{form.portalError}</p>
						{/if}
						<div class="mt-3 flex flex-wrap gap-2 text-sm">
							{#if !contact.isPrimary}
								<form method="post" action="?/setPrimary" use:enhance>
									<input type="hidden" name="contactId" value={contact.id} />
									<button type="submit" class="cursor-pointer font-semibold text-accent hover:underline">
										Als Hauptkontakt setzen
									</button>
								</form>
							{/if}
							{#if data.portalContactIds.includes(contact.id)}
								<form
									method="post"
									action="?/deactivatePortal"
									use:enhance={({ cancel }) => {
										if (!confirm(`Portal-Zugang von ${contact.firstName} ${contact.lastName} entfernen?`)) cancel();
									}}
								>
									<input type="hidden" name="contactId" value={contact.id} />
									<button type="submit" class="cursor-pointer font-semibold text-secondary hover:underline">
										Portal-Zugang entfernen
									</button>
								</form>
							{:else}
								<form method="post" action="?/activatePortal" use:enhance>
									<input type="hidden" name="contactId" value={contact.id} />
									<button type="submit" class="cursor-pointer font-semibold text-accent hover:underline">
										Portal-Zugang einladen
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

<section class="mt-6 rounded-lg border border-border bg-white p-6">
	<div class="flex items-center justify-between gap-4">
		<h2 class="font-display text-lg font-semibold">Verträge</h2>
		{#if editingContract !== 'new'}
			<button
				type="button"
				onclick={() => (editingContract = 'new')}
				class="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm font-semibold transition-colors duration-150 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
			>
				<Plus size={16} aria-hidden="true" />
				Neuer Vertrag
			</button>
		{/if}
	</div>

	{#if editingContract === 'new'}
		<div class="mt-4">
			<ContractForm
				action="?/createContract"
				values={contractValues}
				errors={contractErrors}
				submitLabel="Vertrag anlegen"
				oncancel={() => (editingContract = null)}
			/>
		</div>
	{/if}

	{#if data.contracts.length === 0 && editingContract !== 'new'}
		<p class="mt-4 text-sm text-secondary">Noch keine Verträge hinterlegt.</p>
	{:else}
		<ul class="mt-4 space-y-3">
			{#each data.contracts as { contract, deadlines } (contract.id)}
				<li class="rounded-lg border border-border p-4">
					{#if editingContract === contract.id}
						<ContractForm
							action="?/updateContract"
							contractId={contract.id}
							values={contractValues ?? contractToValues(contract)}
							errors={contractErrors}
							submitLabel="Änderungen speichern"
							oncancel={() => (editingContract = null)}
						/>
					{:else}
						<div class="flex flex-wrap items-start justify-between gap-2">
							<div>
								<p class="font-semibold">
									{contract.title}
									<span
										class="ml-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold {statusTones[contract.status]}"
									>
										{statusLabels[contract.status]}
									</span>
								</p>
								<p class="mt-1 text-sm text-secondary">
									Seit {new Date(contract.startDate).toLocaleDateString('de-DE')} ·
									{contract.initialTermMonths} Monate Laufzeit ·
									{contract.renewalTermMonths > 0
										? `verlängert sich um ${contract.renewalTermMonths} Monate`
										: 'läuft aus'} ·
									{contract.noticePeriodMonths} Monate Kündigungsfrist
								</p>
							</div>
							<p class="font-semibold">{euro.format(contract.monthlyFeeCents / 100)}<span class="text-sm font-normal text-secondary"> / Monat</span></p>
						</div>
						{#if contract.status === 'active'}
							<div class="mt-2">
								<DeadlineBadge {deadlines} />
							</div>
						{/if}
						{#if contract.includedServices}
							<p class="mt-2 text-sm text-secondary">{contract.includedServices}</p>
						{/if}
						<div class="mt-3 flex flex-wrap gap-3 text-sm">
							<button
								type="button"
								onclick={() => (editingContract = contract.id)}
								class="cursor-pointer font-semibold text-secondary hover:underline"
							>
								Bearbeiten
							</button>
							{#if contract.status === 'active'}
								<form
									method="post"
									action="?/cancelContract"
									use:enhance={({ cancel }) => {
										if (!confirm(`Vertrag „${contract.title}" als gekündigt markieren?`)) cancel();
									}}
								>
									<input type="hidden" name="contractId" value={contract.id} />
									<button type="submit" class="cursor-pointer font-semibold text-secondary hover:underline">
										Als gekündigt markieren
									</button>
								</form>
							{/if}
							<form
								method="post"
								action="?/deleteContract"
								use:enhance={({ cancel }) => {
									if (!confirm(`Vertrag „${contract.title}" endgültig löschen?`)) cancel();
								}}
							>
								<input type="hidden" name="contractId" value={contract.id} />
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

<section class="mt-6 rounded-lg border border-border bg-white p-6">
	<h2 class="font-display text-lg font-semibold">Dokumente</h2>

	<form
		method="post"
		action="?/uploadDocument"
		enctype="multipart/form-data"
		use:enhance
		class="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-muted/40 p-4"
	>
		<div>
			<label for="file" class="block text-sm font-semibold">Datei (max. 25 MB)</label>
			<input
				id="file"
				name="file"
				type="file"
				required
				class="mt-1 block cursor-pointer text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-semibold file:text-on-primary hover:file:bg-secondary"
			/>
		</div>
		<label class="flex items-center gap-2 pb-2 text-sm">
			<input
				type="checkbox"
				name="sharedWithCustomer"
				class="rounded border-border text-accent focus:ring-accent"
			/>
			Für Portal freigeben
		</label>
		<button
			type="submit"
			class="flex cursor-pointer items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-on-primary transition-colors duration-150 hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
		>
			<Upload size={16} aria-hidden="true" />
			Hochladen
		</button>
		{#if form && 'documentError' in form && form.documentError}
			<p class="w-full text-sm text-destructive" role="alert">{form.documentError}</p>
		{/if}
	</form>

	{#if data.documents.length === 0}
		<p class="mt-4 text-sm text-secondary">Noch keine Dokumente hinterlegt.</p>
	{:else}
		<div class="mt-4 overflow-x-auto">
			<table class="w-full text-left text-sm">
				<thead class="border-b border-border text-xs uppercase tracking-wide text-secondary">
					<tr>
						<th scope="col" class="py-2 pr-4">Datei</th>
						<th scope="col" class="py-2 pr-4">Größe</th>
						<th scope="col" class="py-2 pr-4">Hochgeladen</th>
						<th scope="col" class="py-2 pr-4">Portal</th>
						<th scope="col" class="py-2"><span class="sr-only">Aktionen</span></th>
					</tr>
				</thead>
				<tbody>
					{#each data.documents as document (document.id)}
						<tr class="border-b border-border last:border-b-0">
							<td class="py-2 pr-4 font-semibold">{document.fileName}</td>
							<td class="py-2 pr-4">{formatBytes(document.sizeBytes)}</td>
							<td class="py-2 pr-4">{new Date(document.createdAt).toLocaleDateString('de-DE')}</td>
							<td class="py-2 pr-4">{document.sharedWithCustomer ? 'freigegeben' : '–'}</td>
							<td class="py-2">
								<div class="flex items-center gap-3">
									<a
										href={resolve('/(app)/firmen/[id]/dokumente/[docId]', {
											id: company.id,
											docId: document.id
										})}
										download={document.fileName}
										class="flex cursor-pointer items-center gap-1 font-semibold text-accent hover:underline"
									>
										<Download size={14} aria-hidden="true" />
										Herunterladen
									</a>
									<form
										method="post"
										action="?/deleteDocument"
										use:enhance={({ cancel }) => {
											if (!confirm(`„${document.fileName}" löschen?`)) cancel();
										}}
									>
										<input type="hidden" name="documentId" value={document.id} />
										<button type="submit" class="cursor-pointer font-semibold text-destructive hover:underline">
											Löschen
										</button>
									</form>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>
