<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { Paperclip } from 'lucide-svelte';
	import { portalStatusLabels, statusTones } from '$lib/tickets/labels';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let ticket = $derived(data.ticket);

	const timeFormat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' });

	// Antwortfeld nach erfolgreichem Senden leeren
	let formEpoch = $derived(form && 'saved' in form && form.saved ? form : null);
</script>

<svelte:head><title>T-{ticket.number} – Corvion Portal</title></svelte:head>

<nav aria-label="Pfad" class="text-sm text-secondary">
	<a href={resolve('/portal/tickets')} class="hover:underline">Anfragen</a>
	<span aria-hidden="true"> / </span>
	<span>T-{ticket.number}</span>
</nav>

<div class="mt-2 flex flex-wrap items-start justify-between gap-3">
	<h1 class="font-display text-2xl font-semibold">
		<span class="font-mono text-lg text-secondary">T-{ticket.number}</span>
		{ticket.subject}
	</h1>
	<span class="rounded-full px-3 py-1 text-sm font-semibold {statusTones[ticket.status]}">
		{portalStatusLabels[ticket.status]}
	</span>
</div>

{#if ticket.status === 'resolved'}
	<section class="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-4">
		<h2 class="font-semibold text-emerald-900">Ist Ihr Anliegen gelöst?</h2>
		<div class="mt-3 flex flex-wrap gap-2">
			<form method="post" action="?/confirm" use:enhance>
				<button
					type="submit"
					class="cursor-pointer rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-colors duration-150 hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				>
					Ja, Anfrage schließen
				</button>
			</form>
			<form method="post" action="?/reopen" use:enhance>
				<button
					type="submit"
					class="cursor-pointer rounded-md border border-border bg-white px-4 py-2 text-sm font-semibold transition-colors duration-150 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
				>
					Nein, es besteht noch Bedarf
				</button>
			</form>
		</div>
	</section>
{/if}

<section class="mt-6 space-y-3">
	<h2 class="sr-only">Verlauf</h2>
	{#each data.messages as message (message.id)}
		<article
			class="rounded-lg border p-4 {message.kind === 'inbound'
				? 'ml-8 border-accent/30 bg-accent/5'
				: 'mr-8 border-border bg-white'}"
		>
			<header class="flex flex-wrap items-center justify-between gap-2 text-xs text-secondary">
				<span class="font-semibold">{message.kind === 'inbound' ? 'Sie' : 'Corvion'}</span>
				<span>{timeFormat.format(message.sentAt ?? message.createdAt)}</span>
			</header>
			<div class="rich-content mt-2 text-sm">
				<!-- eslint-disable-next-line svelte/no-at-html-tags — Inhalt ist serverseitig sanitisiert/escaped -->
				{@html message.bodyHtml}
			</div>
			{#if message.attachments.length > 0}
				<ul class="mt-3 flex flex-wrap gap-3 border-t border-border/60 pt-2">
					{#each message.attachments as attachment (attachment.id)}
						<li>
							<a
								href={resolve('/(portal)/portal/tickets/[id]/anhaenge/[attId]', {
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

{#if ticket.status !== 'closed'}
	{#key formEpoch}
		<form
			method="post"
			action="?/reply"
			enctype="multipart/form-data"
			use:enhance
			class="mt-6 max-w-2xl rounded-lg border border-border bg-white p-4"
		>
			<h2 class="font-display text-lg font-semibold">Antworten</h2>
			<div class="mt-3">
				<label for="body" class="sr-only">Antwort</label>
				<textarea
					id="body"
					name="body"
					rows="4"
					required
					placeholder="Ihre Nachricht an uns"
					class="w-full rounded-md border-border focus:border-accent focus:ring-accent"
				></textarea>
				{#if form && 'errors' in form && form.errors?.body}
					<p class="mt-1 text-sm text-destructive" role="alert">{form.errors.body[0]}</p>
				{/if}
			</div>
			<div class="mt-3 flex flex-wrap items-end gap-3">
				<div>
					<label for="files" class="block text-sm font-semibold">Anhänge (optional)</label>
					<input
						id="files"
						name="files"
						type="file"
						multiple
						class="mt-1 block cursor-pointer text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-on-primary hover:file:bg-secondary"
					/>
				</div>
				<button
					type="submit"
					class="cursor-pointer rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-colors duration-150 hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				>
					Antwort senden
				</button>
			</div>
		</form>
	{/key}
{:else}
	<p class="mt-6 text-sm text-secondary">
		Diese Anfrage ist abgeschlossen. Bei neuem Bedarf stellen Sie bitte eine
		<a href={resolve('/portal/tickets/neu')} class="text-accent hover:underline">neue Anfrage</a>.
	</p>
{/if}

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
</style>
