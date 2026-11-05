<script lang="ts">
	let { text, label = '' }: { text: string; label?: string } = $props();
	let copied = $state(false);

	async function copy() {
		try {
			await navigator.clipboard.writeText(text);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			// clipboard blocked (non-secure context); user can still select the text
		}
	}
</script>

<div class="copy">
	{#if label}<span class="faint lbl">{label}</span>{/if}
	<pre>{text}</pre>
	<button class="small ghost btn" onclick={copy}>{copied ? 'Copied' : 'Copy'}</button>
</div>

<style>
	.copy {
		position: relative;
		margin: 8px 0;
	}
	.lbl {
		font-size: 0.72rem;
		display: block;
		margin-bottom: 2px;
	}
	pre {
		margin: 0;
		padding-right: 64px;
	}
	.btn {
		position: absolute;
		right: 6px;
		bottom: 6px;
	}
</style>
