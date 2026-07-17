<script lang="ts">
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import {
		Bold,
		Italic,
		Heading2,
		Heading3,
		List,
		ListOrdered,
		Code,
		TextQuote,
		Link as LinkIcon
	} from 'lucide-svelte';

	interface Props {
		/** Name des hidden inputs, den die Form Action liest */
		name: string;
		initialHtml?: string;
	}

	let { name, initialHtml = '' }: Props = $props();

	let element = $state<HTMLDivElement>();
	let html = $state('');
	let editor = $state<Editor | null>(null);
	// Zähler, damit die Toolbar-Zustände nach jeder Transaktion neu ausgewertet werden
	let tick = $state(0);

	$effect(() => {
		if (!element) return;
		const instance = new Editor({
			element,
			extensions: [
				StarterKit.configure({
					heading: { levels: [2, 3] },
					link: { openOnClick: false }
				})
			],
			content: initialHtml,
			editorProps: {
				attributes: {
					class: 'min-h-32 max-w-none px-3 py-2 focus:outline-none text-sm'
				}
			},
			onTransaction: () => {
				tick += 1;
			},
			onUpdate: ({ editor: e }) => {
				html = e.getHTML();
			}
		});
		editor = instance;
		html = instance.getHTML();
		return () => {
			instance.destroy();
			editor = null;
		};
	});

	function isActive(nameOrAttrs: string, attrs?: Record<string, unknown>): boolean {
		void tick;
		return editor?.isActive(nameOrAttrs, attrs) ?? false;
	}

	function setLink() {
		if (!editor) return;
		const existing = editor.getAttributes('link').href as string | undefined;
		const url = window.prompt('Link-Adresse (https://…)', existing ?? 'https://');
		if (url === null) return;
		if (url === '' || url === 'https://') {
			editor.chain().focus().unsetLink().run();
			return;
		}
		editor.chain().focus().setLink({ href: url }).run();
	}

	const buttonClass = (active: boolean) =>
		`cursor-pointer rounded p-1.5 transition-colors duration-150 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring ${active ? 'bg-muted text-accent' : 'text-secondary'}`;
</script>

<div class="rounded-md border border-border bg-white">
	<div class="flex flex-wrap gap-1 border-b border-border px-2 py-1" role="toolbar" aria-label="Formatierung">
		<button type="button" title="Fett" aria-label="Fett" class={buttonClass(isActive('bold'))} onclick={() => editor?.chain().focus().toggleBold().run()}>
			<Bold size={16} aria-hidden="true" />
		</button>
		<button type="button" title="Kursiv" aria-label="Kursiv" class={buttonClass(isActive('italic'))} onclick={() => editor?.chain().focus().toggleItalic().run()}>
			<Italic size={16} aria-hidden="true" />
		</button>
		<button type="button" title="Überschrift" aria-label="Überschrift" class={buttonClass(isActive('heading', { level: 2 }))} onclick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
			<Heading2 size={16} aria-hidden="true" />
		</button>
		<button type="button" title="Zwischenüberschrift" aria-label="Zwischenüberschrift" class={buttonClass(isActive('heading', { level: 3 }))} onclick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}>
			<Heading3 size={16} aria-hidden="true" />
		</button>
		<button type="button" title="Aufzählung" aria-label="Aufzählung" class={buttonClass(isActive('bulletList'))} onclick={() => editor?.chain().focus().toggleBulletList().run()}>
			<List size={16} aria-hidden="true" />
		</button>
		<button type="button" title="Nummerierte Liste" aria-label="Nummerierte Liste" class={buttonClass(isActive('orderedList'))} onclick={() => editor?.chain().focus().toggleOrderedList().run()}>
			<ListOrdered size={16} aria-hidden="true" />
		</button>
		<button type="button" title="Code-Block" aria-label="Code-Block" class={buttonClass(isActive('codeBlock'))} onclick={() => editor?.chain().focus().toggleCodeBlock().run()}>
			<Code size={16} aria-hidden="true" />
		</button>
		<button type="button" title="Zitat" aria-label="Zitat" class={buttonClass(isActive('blockquote'))} onclick={() => editor?.chain().focus().toggleBlockquote().run()}>
			<TextQuote size={16} aria-hidden="true" />
		</button>
		<button type="button" title="Link" aria-label="Link" class={buttonClass(isActive('link'))} onclick={setLink}>
			<LinkIcon size={16} aria-hidden="true" />
		</button>
	</div>
	<div bind:this={element} class="rich-text"></div>
</div>
<input type="hidden" {name} value={html} />

<style>
	.rich-text :global(h2) {
		font-size: 1.125rem;
		font-weight: 600;
		margin: 0.5rem 0 0.25rem;
	}
	.rich-text :global(h3) {
		font-size: 1rem;
		font-weight: 600;
		margin: 0.5rem 0 0.25rem;
	}
	.rich-text :global(ul) {
		list-style: disc;
		padding-left: 1.25rem;
	}
	.rich-text :global(ol) {
		list-style: decimal;
		padding-left: 1.25rem;
	}
	.rich-text :global(pre) {
		background: var(--color-muted);
		border-radius: 0.375rem;
		padding: 0.5rem 0.75rem;
		font-size: 0.8125rem;
		overflow-x: auto;
	}
	.rich-text :global(blockquote) {
		border-left: 3px solid var(--color-border);
		padding-left: 0.75rem;
		color: var(--color-secondary);
	}
	.rich-text :global(a) {
		color: var(--color-accent);
		text-decoration: underline;
	}
	.rich-text :global(p) {
		margin: 0.25rem 0;
	}
</style>
