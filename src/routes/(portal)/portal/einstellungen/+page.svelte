<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let setupData = $derived(form && 'totpUri' in form ? form : null);
	let verified = $derived(form && 'verified' in form && form.verified === true);
	let disabled = $derived(form && 'disabled' in form && form.disabled === true);
	let enabled = $derived((data.twoFactorEnabled || verified) && !disabled);
</script>

<svelte:head><title>Einstellungen – Corvion Portal</title></svelte:head>

<h1 class="font-display text-2xl font-semibold">Einstellungen</h1>

<section class="mt-6 max-w-lg rounded-lg border border-border bg-white p-6">
	<h2 class="font-display text-lg font-semibold">Zwei-Faktor-Anmeldung</h2>

	{#if enabled}
		<p class="mt-1 text-sm text-secondary">
			Aktiv — Ihr Konto ist zusätzlich mit einer Authenticator-App geschützt.
		</p>
		<form method="post" action="?/disable" use:enhance class="mt-4 flex flex-wrap items-end gap-3">
			<div>
				<label for="password-disable" class="block text-sm font-semibold">Passwort</label>
				<input
					id="password-disable"
					name="password"
					type="password"
					required
					autocomplete="current-password"
					class="mt-1 rounded-md border-border text-sm focus:border-accent focus:ring-accent"
				/>
			</div>
			<button
				type="submit"
				class="cursor-pointer rounded-md border border-border bg-white px-3 py-2 text-sm font-semibold transition-colors duration-150 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
			>
				Deaktivieren
			</button>
			{#if form && 'message' in form && form.message}
				<p class="w-full text-sm text-destructive" role="alert">{form.message}</p>
			{/if}
		</form>
	{:else if setupData}
		<p class="mt-1 text-sm text-secondary">
			QR-Code mit Ihrer Authenticator-App scannen, dann den angezeigten Code eingeben.
		</p>
		<img src={setupData.qrDataUrl} alt="QR-Code für Authenticator-App" class="mt-4 rounded border border-border" />
		<p class="mt-2 text-sm text-secondary">
			Ohne Kamera: Schlüssel manuell eingeben —
			<code class="rounded bg-muted px-1 font-mono text-xs">{setupData.secret}</code>
		</p>

		<h3 class="mt-4 text-sm font-semibold">Backup-Codes (sicher aufbewahren)</h3>
		<ul class="mt-2 grid grid-cols-2 gap-1 rounded bg-muted p-3 font-mono text-sm">
			{#each setupData.backupCodes as code (code)}
				<li>{code}</li>
			{/each}
		</ul>

		<form method="post" action="?/verify" use:enhance class="mt-4 flex flex-wrap items-end gap-3">
			<div>
				<label for="code" class="block text-sm font-semibold">Bestätigungscode</label>
				<input
					id="code"
					name="code"
					type="text"
					inputmode="numeric"
					autocomplete="one-time-code"
					required
					class="mt-1 rounded-md border-border text-sm focus:border-accent focus:ring-accent"
				/>
			</div>
			<button
				type="submit"
				class="cursor-pointer rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-colors duration-150 hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
			>
				Aktivieren
			</button>
			{#if form && 'message' in form && form.message}
				<p class="w-full text-sm text-destructive" role="alert">{form.message}</p>
			{/if}
		</form>
	{:else}
		<p class="mt-1 text-sm text-secondary">
			Optional: Schützen Sie Ihr Konto zusätzlich mit einer Authenticator-App.
		</p>
		<form method="post" action="?/enable" use:enhance class="mt-4 flex flex-wrap items-end gap-3">
			<div>
				<label for="password-enable" class="block text-sm font-semibold">Passwort bestätigen</label>
				<input
					id="password-enable"
					name="password"
					type="password"
					required
					autocomplete="current-password"
					class="mt-1 rounded-md border-border text-sm focus:border-accent focus:ring-accent"
				/>
			</div>
			<button
				type="submit"
				class="cursor-pointer rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-colors duration-150 hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
			>
				Einrichtung starten
			</button>
			{#if form && 'message' in form && form.message}
				<p class="w-full text-sm text-destructive" role="alert">{form.message}</p>
			{/if}
		</form>
	{/if}
</section>
