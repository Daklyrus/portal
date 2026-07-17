<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { Paperclip } from 'lucide-svelte';
	import RichTextEditor from '$lib/components/RichTextEditor.svelte';
	import { computeSlaDueAt } from '$lib/tickets/sla';
	import {
		priorityLabels,
		priorityOptions,
		priorityTones,
		statusLabels,
		statusOptions,
		statusTones
	} from '$lib/tickets/labels';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let ticket = $derived(data.ticket);

	// Editor nach erfolgreichem Speichern leeren: jedes neue Erfolgs-Objekt erzwingt per {#key} einen Remount
	let editorEpoch = $derived(form && 'ticketSaved' in form && form.ticketSaved ? form : null);

	const messageTone: Record<string, string> = {
		inbound: 'border-border bg-white',
		outbound: 'border-accent/30 bg-accent/5',
		note: 'border-amber-200 bg-amber-50'
	};
	const messageLabel: Record<string, string> = {
		inbound: 'Kunde',
		outbound: 'Antwort',
		note: 'Interne Notiz'
	};

	const timeFormat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' });

	let replyErrors = $derived(form && 'replyErrors' in form ? form.replyErrors : {});
	let noteErrors = $derived(form && 'noteErrors' in form ? form.noteErrors : {});
	let assignErrors = $derived(form && 'assignErrors' in form ? form.assignErrors : {});
</script>

<svelte:head><title>T-{ticket.number} {ticket.subject} – Corvion Tool</title></svelte:head>

<nav aria-label="Pfad" class="text-sm text-secondary">
	<a href={resolve('/tickets')} class="hover:underline">Tickets</a>
	<span aria-hidden="true"> / </span>
	<span>T-{ticket.number}</span>
</nav>

<div class="mt-2 flex flex-wrap items-start justify-between gap-4">
	<div>
		<h1 class="font-display text-2xl font-semibold">
			<span class="font-mono text-lg text-secondary">T-{ticket.number}</span>
			{ticket.subject}
		</h1>
		<p class="mt-1 text-sm text-secondary">
			{#if data.company}
				<a href={resolve('/(app)/firmen/[id]', { id: data.company.id })} class="text-accent hover:underline">
					{data.company.name}
				</a>
				{#if data.contact}· {data.contact.firstName} {data.contact.lastName}{/if}
			{:else if ticket.requesterName || ticket.requesterEmail}
				{ticket.requesterName ?? ''} {ticket.requesterEmail ? `<${ticket.requesterEmail}>` : ''}
			{/if}
			{#if ticket.status === 'new' || ticket.status === 'in_progress'}
				· Antwort bis {timeFormat.format(computeSlaDueAt(ticket.createdAt, ticket.priority))}
			{/if}
		</p>
	</div>
	<div class="flex flex-wrap gap-2">
		<form method="post" action="?/setStatus" use:enhance>
			<label class="sr-only" for="status">Status</label>
			<select
				id="status"
				name="status"
				onchange={(e) => e.currentTarget.form?.requestSubmit()}
				class="rounded-md border-border text-sm font-semibold focus:border-accent focus:ring-accent {statusTones[ticket.status]}"
			>
				{#each statusOptions as option (option.value)}
					<option value={option.value} selected={ticket.status === option.value}>{option.label}</option>
				{/each}
			</select>
		</form>
		<form method="post" action="?/setPriority" use:enhance>
			<label class="sr-only" for="priority">Priorität</label>
			<select
				id="priority"
				name="priority"
				onchange={(e) => e.currentTarget.form?.requestSubmit()}
				class="rounded-md border-border text-sm font-semibold focus:border-accent focus:ring-accent {priorityTones[ticket.priority]}"
			>
				{#each priorityOptions as option (option.value)}
					<option value={option.value} selected={ticket.priority === option.value}>{option.label}</option>
				{/each}
			</select>
		</form>
		<form method="post" action="?/assignUser" use:enhance>
			<label class="sr-only" for="assignedToId">Bearbeiter</label>
			<select
				id="assignedToId"
				name="assignedToId"
				onchange={(e) => e.currentTarget.form?.requestSubmit()}
				class="rounded-md border-border text-sm focus:border-accent focus:ring-accent"
			>
				<option value="" selected={!ticket.assignedToId}>– Bearbeiter –</option>
				{#each data.users as user (user.id)}
					<option value={user.id} selected={ticket.assignedToId === user.id}>{user.name}</option>
				{/each}
			</select>
		</form>
	</div>
</div>

{#if !data.company}
	<section class="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
		<h2 class="text-sm font-semibold text-destructive">Keiner Firma zugeordnet</h2>
		<form method="post" action="?/assignCompany" use:enhance class="mt-3 flex flex-wrap items-end gap-3">
			<div>
				<label for="companyId" class="block text-sm font-semibold">Firma</label>
				<select
					id="companyId"
					name="companyId"
					required
					class="mt-1 rounded-md border-border text-sm focus:border-accent focus:ring-accent"
				>
					<option value="">– wählen –</option>
					{#each data.companies as company (company.id)}
						<option value={company.id}>{company.name}</option>
					{/each}
				</select>
			</div>
			<label class="flex items-center gap-2 pb-2 text-sm">
				<input type="checkbox" name="saveContact" class="rounded border-border text-accent focus:ring-accent" />
				Absender als Ansprechpartner speichern
			</label>
			<div>
				<label for="firstName" class="block text-sm font-semibold">Vorname</label>
				<input
					id="firstName"
					name="firstName"
					type="text"
					value={ticket.requesterName?.split(' ')[0] ?? ''}
					class="mt-1 w-36 rounded-md border-border text-sm focus:border-accent focus:ring-accent"
				/>
			</div>
			<div>
				<label for="lastName" class="block text-sm font-semibold">Nachname</label>
				<input
					id="lastName"
					name="lastName"
					type="text"
					value={ticket.requesterName?.split(' ').slice(1).join(' ') ?? ''}
					class="mt-1 w-36 rounded-md border-border text-sm focus:border-accent focus:ring-accent"
				/>
			</div>
			<button
				type="submit"
				class="cursor-pointer rounded-md bg-primary px-3 py-2 text-sm font-semibold text-on-primary transition-colors duration-150 hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
			>
				Zuordnen
			</button>
			{#if assignErrors && Object.keys(assignErrors).length > 0}
				<p class="w-full text-sm text-destructive" role="alert">
					{Object.values(assignErrors).flat()[0]}
				</p>
			{/if}
		</form>
	</section>
{/if}

<section class="mt-6 space-y-3">
	<h2 class="sr-only">Verlauf</h2>
	{#each data.messages as message (message.id)}
		<article class="rounded-lg border p-4 {messageTone[message.kind]}">
			<header class="flex flex-wrap items-center justify-between gap-2 text-xs text-secondary">
				<span class="font-semibold">
					{messageLabel[message.kind]}
					{#if message.kind === 'inbound' && message.fromEmail}
						· {message.fromEmail}
					{:else if message.author}
						· {message.author.name}
					{/if}
				</span>
				<span>{timeFormat.format(message.sentAt ?? message.createdAt)}</span>
			</header>
			<div class="rich-content mt-2 text-sm">
				<!-- eslint-disable-next-line svelte/no-at-html-tags — Inhalt ist serverseitig sanitisiert -->
				{@html message.bodyHtml}
			</div>
			{#if message.attachments.length > 0}
				<ul class="mt-3 flex flex-wrap gap-3 border-t border-border/60 pt-2">
					{#each message.attachments as attachment (attachment.id)}
						<li>
							<a
								href={resolve('/(app)/tickets/[id]/anhaenge/[attId]', {
									id: ticket.id,
									attId: attachment.id
								})}
								class="flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
							>
								<Paperclip size={12} aria-hidden="true" />
								{attachment.fileName}
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</article>
	{/each}
</section>

{#key editorEpoch}
	<section class="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
		<form method="post" action="?/reply" use:enhance class="rounded-lg border border-border bg-white p-4">
			<h2 class="font-display text-lg font-semibold">Antworten</h2>
			<div class="mt-3">
				<label for="to" class="block text-sm font-semibold">An</label>
				<input
					id="to"
					name="to"
					type="email"
					required
					value={ticket.requesterEmail ?? data.contact?.email ?? ''}
					class="mt-1 w-full rounded-md border-border text-sm focus:border-accent focus:ring-accent"
				/>
				{#if replyErrors?.to}<p class="mt-1 text-sm text-destructive" role="alert">{replyErrors.to[0]}</p>{/if}
			</div>
			<div class="mt-3">
				<span class="block text-sm font-semibold">Nachricht</span>
				<div class="mt-1"><RichTextEditor name="bodyHtml" /></div>
				{#if replyErrors?.bodyHtml}<p class="mt-1 text-sm text-destructive" role="alert">{replyErrors.bodyHtml[0]}</p>{/if}
			</div>
			<div class="mt-3 flex flex-wrap items-center gap-3">
				<button
					type="submit"
					class="cursor-pointer rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-colors duration-150 hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				>
					Antwort senden
				</button>
				<label for="setStatus" class="text-sm text-secondary">Status danach:</label>
				<select id="setStatus" name="setStatus" class="rounded-md border-border text-sm focus:border-accent focus:ring-accent">
					<option value="">unverändert</option>
					<option value="waiting_customer">{statusLabels.waiting_customer}</option>
					<option value="resolved">{statusLabels.resolved}</option>
				</select>
			</div>
		</form>

		<form method="post" action="?/note" use:enhance class="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
			<h2 class="font-display text-lg font-semibold">Interne Notiz</h2>
			<p class="mt-1 text-xs text-secondary">Nur fürs Team — geht nie per Mail raus.</p>
			<div class="mt-3">
				<span class="block text-sm font-semibold">Notiz</span>
				<div class="mt-1"><RichTextEditor name="bodyHtml" /></div>
				{#if noteErrors?.bodyHtml}<p class="mt-1 text-sm text-destructive" role="alert">{noteErrors.bodyHtml[0]}</p>{/if}
			</div>
			<button
				type="submit"
				class="mt-3 cursor-pointer rounded-md border border-border bg-white px-4 py-2 text-sm font-semibold transition-colors duration-150 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
			>
				Notiz speichern
			</button>
		</form>
	</section>
{/key}

<style>
	.rich-content :global(p) {
		margin: 0.25rem 0;
	}
	.rich-content :global(ul) {
		list-style: disc;
		padding-left: 1.25rem;
	}
	.rich-content :global(ol) {
		list-style: decimal;
		padding-left: 1.25rem;
	}
	.rich-content :global(a) {
		color: var(--color-accent);
		text-decoration: underline;
	}
	.rich-content :global(pre) {
		background: var(--color-muted);
		border-radius: 0.375rem;
		padding: 0.5rem 0.75rem;
		overflow-x: auto;
	}
	.rich-content :global(blockquote) {
		border-left: 3px solid var(--color-border);
		padding-left: 0.75rem;
		color: var(--color-secondary);
	}
	.rich-content :global(h1),
	.rich-content :global(h2),
	.rich-content :global(h3) {
		font-weight: 600;
		margin: 0.5rem 0 0.25rem;
	}
	.rich-content :global(img) {
		max-width: 100%;
	}
	.rich-content :global(table) {
		border-collapse: collapse;
	}
	.rich-content :global(td),
	.rich-content :global(th) {
		border: 1px solid var(--color-border);
		padding: 0.25rem 0.5rem;
	}
</style>
