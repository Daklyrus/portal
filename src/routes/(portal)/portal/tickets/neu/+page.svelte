<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<svelte:head><title>Neue Anfrage – Corvion Portal</title></svelte:head>

<nav aria-label="Pfad" class="text-sm text-secondary">
	<a href={resolve('/portal/tickets')} class="hover:underline">Anfragen</a>
	<span aria-hidden="true"> / </span>
	<span>Neue Anfrage</span>
</nav>

<h1 class="mt-2 font-display text-2xl font-semibold">Neue Anfrage</h1>
<p class="mt-1 text-sm text-secondary">
	Beschreiben Sie Ihr Anliegen — wir melden uns per E-Mail und hier im Portal.
</p>

<form method="post" enctype="multipart/form-data" use:enhance class="mt-6 max-w-xl space-y-4">
	<div>
		<label for="subject" class="block text-sm font-semibold">
			Betreff<span class="text-destructive"> *</span>
		</label>
		<input
			id="subject"
			name="subject"
			type="text"
			required
			value={form?.values?.subject ?? ''}
			class="mt-1 w-full rounded-md border-border focus:border-accent focus:ring-accent"
		/>
		{#if form?.errors?.subject}<p class="mt-1 text-sm text-destructive" role="alert">{form.errors.subject[0]}</p>{/if}
	</div>
	<div>
		<label for="body" class="block text-sm font-semibold">
			Beschreibung<span class="text-destructive"> *</span>
		</label>
		<textarea
			id="body"
			name="body"
			rows="6"
			required
			placeholder="Was ist passiert? Seit wann? Welche Geräte oder Programme sind betroffen?"
			class="mt-1 w-full rounded-md border-border focus:border-accent focus:ring-accent"
			>{form?.values?.body ?? ''}</textarea
		>
		{#if form?.errors?.body}<p class="mt-1 text-sm text-destructive" role="alert">{form.errors.body[0]}</p>{/if}
	</div>
	<div>
		<label for="files" class="block text-sm font-semibold">Anhänge (optional, je max. 25 MB)</label>
		<input
			id="files"
			name="files"
			type="file"
			multiple
			class="mt-1 block cursor-pointer text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-semibold file:text-on-primary hover:file:bg-secondary"
		/>
	</div>
	<button
		type="submit"
		class="cursor-pointer rounded-md bg-primary px-4 py-2 font-semibold text-on-primary transition-colors duration-150 hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
	>
		Anfrage absenden
	</button>
</form>
