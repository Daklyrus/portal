<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<svelte:head><title>Anmelden – Corvion Tool</title></svelte:head>

<div class="flex min-h-screen items-center justify-center px-4">
	<div class="w-full max-w-sm rounded-lg border border-border bg-white p-8 shadow-sm">
		<h1 class="font-display text-xl font-semibold text-primary">Corvion Tool</h1>
		<p class="mt-1 text-sm text-secondary">Mit deinem internen Konto anmelden.</p>

		<form method="post" use:enhance class="mt-6 space-y-4">
			<div>
				<label for="email" class="block text-sm font-semibold">E-Mail</label>
				<input
					id="email"
					name="email"
					type="email"
					required
					autocomplete="email"
					value={form?.email ?? ''}
					class="mt-1 w-full rounded-md border-border focus:border-accent focus:ring-accent"
				/>
			</div>
			<div>
				<label for="password" class="block text-sm font-semibold">Passwort</label>
				<input
					id="password"
					name="password"
					type="password"
					required
					autocomplete="current-password"
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
				Anmelden
			</button>
		</form>
	</div>
</div>
