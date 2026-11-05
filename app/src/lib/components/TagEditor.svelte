<script lang="ts">
	interface Props {
		values: string[];
		suggestions: string[];
		placeholder: string;
		colorOf?: (name: string) => string | undefined;
		onchange: (next: string[]) => void;
	}
	let { values, suggestions, placeholder, colorOf, onchange }: Props = $props();

	let draft = $state('');
	const listId = `tags-${Math.random().toString(36).slice(2)}`;
	const remaining = $derived(
		suggestions.filter((s) => !values.some((v) => v.toLowerCase() === s.toLowerCase()))
	);

	function add() {
		const v = draft.trim();
		draft = '';
		if (!v || values.some((x) => x.toLowerCase() === v.toLowerCase())) return;
		onchange([...values, v]);
	}
</script>

<div class="tags">
	{#each values as v (v)}
		<span class="chip" style:border-color={colorOf?.(v)} style:color={colorOf?.(v)}>
			{v}
			<button class="x" onclick={() => onchange(values.filter((x) => x !== v))} aria-label="Remove {v}">×</button>
		</span>
	{/each}
	<input
		class="add"
		list={listId}
		bind:value={draft}
		{placeholder}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ',') {
				e.preventDefault();
				add();
			}
		}}
		onchange={add}
	/>
	<datalist id={listId}>
		{#each remaining as s (s)}<option value={s}></option>{/each}
	</datalist>
</div>

<style>
	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		align-items: center;
	}
	.x {
		background: none;
		border: none;
		padding: 0 0 0 2px;
		color: inherit;
		line-height: 1;
	}
	.add {
		width: 110px;
		padding: 2px 8px;
		font-size: 0.75rem;
		border-radius: 999px;
		border-style: dashed;
		background: transparent;
	}
</style>
