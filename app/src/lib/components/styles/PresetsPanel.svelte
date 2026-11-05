<script lang="ts">
	import { goto } from '$app/navigation';
	import { api } from '$lib/client/api';
	import { studio } from '$lib/client/studio.svelte';
	import type { Preset } from '$lib/types';

	type Draft = Pick<Preset, 'name' | 'style' | 'notes' | 'default_lyrics' | 'cot' | 'target_seconds'> & {
		tags: string;
	};

	let q = $state('');
	let tag = $state('');
	let editing = $state<number | 'new' | null>(null);
	let draft = $state<Draft>(blank());
	let confirmId = $state<number | null>(null);

	function blank(): Draft {
		return { name: '', style: '', notes: '', default_lyrics: '', cot: null, target_seconds: null, tags: '' };
	}

	const tags = $derived([...new Set(studio.presets.flatMap((p) => p.tags))].sort());
	const usage = $derived.by(() => {
		const m = new Map<number, number>();
		for (const j of studio.jobs) if (j.preset_id) m.set(j.preset_id, (m.get(j.preset_id) ?? 0) + 1);
		return m;
	});
	const shown = $derived(
		studio.presets.filter((p) => {
			if (tag && !p.tags.includes(tag)) return false;
			if (!q) return true;
			const hay = `${p.name}\n${p.style}\n${p.notes}`.toLowerCase();
			return q.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
		})
	);

	function edit(p: Preset | null) {
		editing = p ? p.id : 'new';
		draft = p
			? { name: p.name, style: p.style, notes: p.notes, default_lyrics: p.default_lyrics, cot: p.cot, target_seconds: p.target_seconds, tags: p.tags.join(', ') }
			: blank();
	}

	async function save() {
		const payload = { ...draft, tags: draft.tags.split(',').map((t) => t.trim()).filter(Boolean) };
		const ok =
			editing === 'new'
				? await studio.attempt(() => api.createPreset(payload), 'Preset created')
				: await studio.attempt(() => api.updatePreset(editing as number, payload), 'Preset saved');
		if (ok) editing = null;
	}

	async function remove(id: number) {
		if (confirmId !== id) {
			confirmId = id;
			setTimeout(() => (confirmId = null), 3000);
			return;
		}
		await studio.attempt(() => api.deletePreset(id), 'Preset deleted');
	}

	function use(p: Preset) {
		studio.draft = {
			title: p.name,
			style: p.style,
			lyrics: p.default_lyrics,
			cot: p.cot ?? 'off',
			target_seconds: p.target_seconds,
			seed: null,
			preset_id: p.id
		};
		void goto('/generate');
	}
</script>

<div class="row bar">
	<input type="search" placeholder="Search presets…" bind:value={q} />
	<select bind:value={tag} aria-label="Folder / tag">
		<option value="">All folders & tags</option>
		{#each tags as t (t)}<option value={t}>{t}</option>{/each}
	</select>
	<span class="spacer"></span>
	<button class="primary" onclick={() => edit(null)}>+ New preset</button>
</div>

{#snippet editor()}
	<form
		class="panel editor"
		onsubmit={(e) => {
			e.preventDefault();
			void save();
		}}
	>
		<label for="pn">Name</label>
		<input id="pn" bind:value={draft.name} required />
		<label for="ps">Style prompt</label>
		<textarea id="ps" rows="3" bind:value={draft.style} required></textarea>
		<div class="row two">
			<div>
				<label for="pc">Planning mode</label>
				<select id="pc" bind:value={draft.cot}>
					<option value={null}>no preference</option>
					<option value="off">off</option>
					<option value="melody">melody</option>
					<option value="full">full</option>
				</select>
			</div>
			<div>
				<label for="pt">Target length (s)</label>
				<input id="pt" type="number" min="1" max="600" bind:value={draft.target_seconds} />
			</div>
			<div>
				<label for="ptag">Tags (comma separated)</label>
				<input id="ptag" bind:value={draft.tags} />
			</div>
		</div>
		<label for="pno">Notes</label>
		<textarea id="pno" rows="2" bind:value={draft.notes}></textarea>
		<label for="pl">Default lyrics</label>
		<textarea id="pl" rows="6" bind:value={draft.default_lyrics}></textarea>
		<div class="row actions">
			<button type="submit" class="primary">Save</button>
			<button type="button" class="ghost" onclick={() => (editing = null)}>Cancel</button>
		</div>
	</form>
{/snippet}

{#if editing === 'new'}{@render editor()}{/if}

<div class="grid">
	{#each shown as p (p.id)}
		{#if editing === p.id}
			{@render editor()}
		{:else}
			<article class="panel preset">
				<header class="row">
					<h3>{p.name}</h3>
					<span class="spacer"></span>
					{#if p.bpm}<span class="chip">{p.bpm} BPM</span>{/if}
				</header>
				<p class="style">{p.style}</p>
				{#if p.notes}<p class="notes faint">{p.notes}</p>{/if}
				<div class="row meta faint">
					<span>{p.genre}</span>
					{#if p.cot}<span>cot {p.cot}</span>{/if}
					{#if p.target_seconds}<span>{p.target_seconds}s</span>{/if}
					{#each p.tags as t (t)}<span class="chip">{t}</span>{/each}
					{#if usage.get(p.id)}
						<a href="/gallery?preset={p.id}">{usage.get(p.id)} song{usage.get(p.id) === 1 ? '' : 's'} →</a>
					{/if}
				</div>
				{#if p.source_file && !p.source_file.startsWith('builtin:')}
					<p class="faint src">song-prompts/{p.source_file}</p>
				{/if}
				<footer class="row">
					<button class="small primary" onclick={() => use(p)}>Use</button>
					<button class="small" onclick={() => edit(p)}>Edit</button>
					<span class="spacer"></span>
					<button class="small danger" class:confirm={confirmId === p.id} onclick={() => remove(p.id)}>
						{confirmId === p.id ? 'Confirm?' : 'Delete'}
					</button>
				</footer>
			</article>
		{/if}
	{:else}
		<p class="muted">No presets match.</p>
	{/each}
</div>

<style>
	.bar {
		margin-bottom: 12px;
	}
	.bar input {
		max-width: 320px;
	}
	.bar select {
		width: auto;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
		gap: 12px;
	}
	.preset {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px 14px;
	}
	h3 {
		margin: 0;
		font-size: 0.95rem;
	}
	.style {
		margin: 0;
		font-size: 0.8rem;
		color: var(--text-dim);
	}
	.notes {
		margin: 0;
		font-size: 0.75rem;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.meta {
		font-size: 0.72rem;
		gap: 6px 10px;
	}
	.src {
		margin: 0;
		font-size: 0.7rem;
	}
	footer {
		margin-top: auto;
	}
	.editor {
		grid-column: 1 / -1;
		margin-bottom: 12px;
	}
	.two > div {
		flex: 1;
		min-width: 160px;
	}
	.actions {
		margin-top: 12px;
	}
	.confirm {
		border-color: var(--error);
		color: var(--error);
	}
</style>
