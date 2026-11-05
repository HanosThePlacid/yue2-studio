<script lang="ts">
	import { api } from '$lib/client/api';
	import { studio } from '$lib/client/studio.svelte';

	let name = $state('');
	let color = $state('#3b82f6');
	let confirmId = $state<number | null>(null);

	async function add() {
		if (!name.trim()) return;
		if (await studio.attempt(() => api.saveFlag(name, color))) name = '';
	}

	async function remove(id: number) {
		if (confirmId !== id) {
			confirmId = id;
			setTimeout(() => (confirmId = null), 3000);
			return;
		}
		await studio.attempt(() => api.deleteFlag(id), 'Flag removed from all songs');
	}
</script>

<details>
	<summary class="faint">Manage flags</summary>
	<div class="list">
		{#each studio.flags as f (f.id)}
			<div class="row item">
				<input
					type="color"
					value={f.color}
					onchange={(e) => studio.attempt(() => api.saveFlag(f.name, e.currentTarget.value))}
					aria-label="Color for {f.name}"
				/>
				<span class="chip" style:border-color={f.color} style:color={f.color}>{f.name}</span>
				<span class="faint count">{studio.jobs.filter((j) => j.flags.some((x) => x.toLowerCase() === f.name.toLowerCase())).length}</span>
				<button class="small danger" class:confirm={confirmId === f.id} onclick={() => remove(f.id)}>
					{confirmId === f.id ? 'Confirm?' : 'Delete'}
				</button>
			</div>
		{/each}
		<form
			class="row item"
			onsubmit={(e) => {
				e.preventDefault();
				void add();
			}}
		>
			<input type="color" bind:value={color} aria-label="New flag color" />
			<input class="name" placeholder="new flag…" bind:value={name} />
			<button class="small" type="submit">Add</button>
		</form>
	</div>
</details>

<style>
	summary {
		cursor: pointer;
		font-size: 0.75rem;
	}
	.list {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-top: 8px;
	}
	.item {
		flex-wrap: nowrap;
	}
	input[type='color'] {
		width: 28px;
		height: 24px;
		padding: 0;
		border: none;
		background: none;
	}
	.count {
		font-size: 0.72rem;
		width: 30px;
	}
	.name {
		width: 160px;
		padding: 4px 8px;
	}
	.confirm {
		border-color: var(--error);
		color: var(--error);
	}
</style>
