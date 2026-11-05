<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import ComparePanel from '$lib/components/styles/ComparePanel.svelte';
	import PresetsPanel from '$lib/components/styles/PresetsPanel.svelte';
	import StyleGroups from '$lib/components/styles/StyleGroups.svelte';

	const TABS = { presets: 'Presets', compare: 'Compare', groups: 'By style' } as const;
	type Tab = keyof typeof TABS;

	const tab = $derived((page.url.searchParams.get('tab') as Tab) in TABS ? (page.url.searchParams.get('tab') as Tab) : 'presets');
</script>

<div class="page">
	<div class="subtabs">
		{#each Object.entries(TABS) as [k, label] (k)}
			<button class:active={tab === k} onclick={() => goto(`?tab=${k}`, { replaceState: true, noScroll: true })}>{label}</button>
		{/each}
	</div>

	{#if tab === 'presets'}
		<PresetsPanel />
	{:else if tab === 'compare'}
		<ComparePanel />
	{:else}
		<StyleGroups />
	{/if}
</div>
