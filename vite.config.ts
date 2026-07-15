import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig(({ mode }) => ({
	plugins: [tailwindcss(), sveltekit()],
	test: {
		env: loadEnv(mode, process.cwd(), ''),
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					// Integrationstests teilen sich eine Test-DB — nie parallel laufen lassen
					fileParallelism: false
				}
			}
		]
	}
}));
