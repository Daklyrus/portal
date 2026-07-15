<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<svelte:head><title>Zwei-Faktor-Bestätigung – Corvion Tool</title></svelte:head>

<div class="flex min-h-screen items-center justify-center px-4">
	<div class="w-full max-w-sm rounded-lg border border-border bg-white p-8 shadow-sm">
		<h1 class="font-display text-xl font-semibold text-primary">Zwei-Faktor-Bestätigung</h1>
		<p class="mt-1 text-sm text-secondary">Code aus deiner Authenticator-App eingeben.</p>

		<form method="post" use:enhance class="mt-6 space-y-4">
			<div>
				<label for="code" class="block text-sm font-semibold">Bestätigungscode</label>
				<input
					id="code"
					name="code"
					type="text"
					inputmode="numeric"
					autocomplete="one-time-code"
					required
					class="mt-1 w-full rounded-md border-border focus:border-accent focus:ring-accent"
				/>
			</div>
			<label class="flex items-center gap-2 text-sm">
				<input type="checkbox" name="backup" class="rounded border-border text-accent focus:ring-accent" />
				Backup-Code verwenden
			</label>

			{#if form?.message}
				<p class="text-sm text-destructive" role="alert">{form.message}</p>
			{/if}

			<button
				type="submit"
				class="w-full cursor-pointer rounded-md bg-primary px-4 py-2 font-semibold text-on-primary transition-colors duration-150 hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
			>
				Bestätigen
			</button>
		</form>
	</div>
</div>
