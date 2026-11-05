<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import PromptGuide from '$lib/components/guide/PromptGuide.svelte';
	import SunoGuide from '$lib/components/guide/SunoGuide.svelte';
	import YueGuide from '$lib/components/guide/YueGuide.svelte';

	const TABS = { yue2: 'YuE2: what it can do', prompting: 'How to prompt', suno: 'Suno tips' } as const;
	type Tab = keyof typeof TABS;

	const tab = $derived((page.url.searchParams.get('tab') as Tab) in TABS ? (page.url.searchParams.get('tab') as Tab) : 'yue2');
</script>

<div class="page guide">
	<div class="subtabs">
		{#each Object.entries(TABS) as [k, label] (k)}
			<button class:active={tab === k} onclick={() => goto(`?tab=${k}`, { replaceState: true, noScroll: true })}>{label}</button>
		{/each}
	</div>

	{#if tab === 'yue2'}
		<YueGuide />
	{:else if tab === 'prompting'}
		<PromptGuide />
	{:else}
		<SunoGuide />
	{/if}
</div>

<style>
	.guide {
		max-width: 980px;
	}
	.guide :global(section h2) {
		margin-top: 26px;
	}
	.guide :global(section li) {
		margin: 4px 0;
	}
</style>
