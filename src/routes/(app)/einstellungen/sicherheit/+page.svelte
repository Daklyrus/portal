<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let setupData = $derived(form && 'totpUri' in form ? form : null);
	// use:enhance invalidiert nach erfolgreicher Action alle Daten — data.twoFactorEnabled zieht nach
	let verified = $derived(form && 'verified' in form && form.verified === true);
</script>

<svelte:head><title>Sicherheit – Corvion Tool</title></svelte:head>

<div class="max-w-lg">
	<h1 class="font-display text-2xl font-semibold">Sicherheit</h1>

	{#if data.twoFactorEnabled || verified}
		<div class="mt-6 rounded-lg border border-border bg-white p-6">
			<h2 class="font-semibold">Zwei-Faktor-Authentifizierung ist aktiv</h2>
			<p class="mt-1 text-sm text-secondary">
				Dein Konto ist mit einer Authenticator-App abgesichert.
			</p>
			<a
				href={resolve('/')}
				class="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-colors duration-150 hover:bg-secondary"
			>
				Zum Dashboard
			</a>
		</div>
	{:else if setupData}
		<div class="mt-6 rounded-lg border border-border bg-white p-6">
			<h2 class="font-semibold">Schritt 2: Code scannen und bestätigen</h2>
			<p class="mt-1 text-sm text-secondary">
				QR-Code mit deiner Authenticator-App scannen (z.&nbsp;B. Microsoft Authenticator), dann den
				angezeigten Code eingeben.
			</p>
			<img src={setupData.qrDataUrl} alt="QR-Code für Authenticator-App" class="mt-4 rounded border border-border" />
			<p class="mt-2 text-sm text-secondary">
				Ohne Kamera: Schlüssel manuell eingeben —
				<code class="rounded bg-muted px-1 font-mono text-xs" data-testid="totp-secret">{setupData.secret}</code>
			</p>

			<h3 class="mt-6 text-sm font-semibold">Backup-Codes</h3>
			<p class="text-sm text-secondary">
				Sicher ablegen — jeder Code ersetzt einmalig die Authenticator-App.
			</p>
			<ul class="mt-2 grid grid-cols-2 gap-1 rounded bg-muted p-3 font-mono text-sm">
				{#each setupData.backupCodes as code (code)}
					<li>{code}</li>
				{/each}
			</ul>

			<form method="post" action="?/verify" use:enhance class="mt-6 space-y-4">
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
				{#if form && 'message' in form && form.message}
					<p class="text-sm text-destructive" role="alert">{form.message}</p>
				{/if}
				<button
					type="submit"
					class="cursor-pointer rounded-md bg-primary px-4 py-2 font-semibold text-on-primary transition-colors duration-150 hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				>
					2FA aktivieren
				</button>
			</form>
		</div>
	{:else}
		<div class="mt-6 rounded-lg border border-border bg-white p-6">
			<h2 class="font-semibold">Zwei-Faktor-Authentifizierung einrichten</h2>
			<p class="mt-1 text-sm text-secondary">
				2FA ist für interne Konten Pflicht. Passwort bestätigen, um die Einrichtung zu starten.
			</p>
			<form method="post" action="?/enable" use:enhance class="mt-4 space-y-4">
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
				{#if form && 'message' in form && form.message}
					<p class="text-sm text-destructive" role="alert">{form.message}</p>
				{/if}
				<button
					type="submit"
					class="cursor-pointer rounded-md bg-primary px-4 py-2 font-semibold text-on-primary transition-colors duration-150 hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				>
					Einrichtung starten
				</button>
			</form>
		</div>
	{/if}
</div>
