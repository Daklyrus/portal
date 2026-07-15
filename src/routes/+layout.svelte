<script lang="ts">
	import '@fontsource/open-sans/400.css';
	import '@fontsource/open-sans/600.css';
	import '@fontsource/open-sans/700.css';
	import '@fontsource/poppins/500.css';
	import '@fontsource/poppins/600.css';
	import '@fontsource/poppins/700.css';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}
