<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head><title>Passwort festlegen – Corvion</title></svelte:head>

<div class="flex min-h-screen items-center justify-center px-4">
	<div class="w-full max-w-sm rounded-lg border border-border bg-white p-8 shadow-sm">
		<h1 class="font-display text-xl font-semibold text-primary">Passwort festlegen</h1>
		<p class="mt-1 text-sm text-secondary">Mindestens 12 Zeichen.</p>

		<form method="post" use:enhance class="mt-6 space-y-4">
			<input type="hidden" name="token" value={data.token} />
			<div>
				<label for="newPassword" class="block text-sm font-semibold">Neues Passwort</label>
				<input
					id="newPassword"
					name="newPassword"
					type="password"
					required
					minlength="12"
					autocomplete="new-password"
					class="mt-1 w-full rounded-md border-border focus:border-accent focus:ring-accent"
				/>
			</div>
			<div>
				<label for="confirm" class="block text-sm font-semibold">Passwort wiederholen</label>
				<input
					id="confirm"
					name="confirm"
					type="password"
					required
					minlength="12"
					autocomplete="new-password"
					class="mt-1 w-full rounded-md border-border focus:border-accent focus:ring-accent"
				/>
			</div>

			{#if form?.message}
				<p class="text-sm text-destructive" role="alert">{form.message}</p>
			{/if}

			<button
				type="submit"
				class="w-full cursor-pointer rounded-md bg-primary px-4 py-2 font-semibold text-on-primary transition-colors duration-150 hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
			>
				Passwort speichern
			</button>
		</form>
	</div>
</div>
