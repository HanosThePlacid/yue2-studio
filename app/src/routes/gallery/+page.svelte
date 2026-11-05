<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import FlagManager from '$lib/components/FlagManager.svelte';
	import SongCard from '$lib/components/SongCard.svelte';
	import { api } from '$lib/client/api';
	import {
		SORT_LABELS,
		activeFilterCount,
		matches,
		parseFilters,
		sortJobs,
		toSearchParams,
		type Filters,
		type SortKey
	} from '$lib/client/filters';
	import { dayLabel } from '$lib/client/format';
	import { studio } from '$lib/client/studio.svelte';
	import { LANGUAGE_LABELS } from '$lib/detect';
	import type { Job } from '$lib/types';

	const f = $derived(parseFilters(page.url.searchParams));

	function set(patch: Partial<Filters>) {
		const qs = toSearchParams({ ...f, ...patch }).toString();
		void goto(qs ? `?${qs}` : page.url.pathname, { replaceState: true, keepFocus: true, noScroll: true });
	}

	const toggle = (list: string[], v: string) =>
		list.some((x) => x.toLowerCase() === v.toLowerCase()) ? list.filter((x) => x.toLowerCase() !== v.toLowerCase()) : [...list, v];

	const results = $derived(sortJobs(studio.jobs.filter((j) => matches(j, f)), f.sort));

	// Timeline headers only make sense for date sorts.
	const groups = $derived.by(() => {
		if (!f.group || (f.sort !== 'newest' && f.sort !== 'oldest')) return [{ label: '', jobs: results }];
		const out: { label: string; jobs: Job[] }[] = [];
		for (const j of results) {
			const label = dayLabel(j.created_at);
			if (out.at(-1)?.label !== label) out.push({ label, jobs: [] });
			out.at(-1)!.jobs.push(j);
		}
		return out;
	});

	const genres = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const j of studio.jobs) counts.set(j.genre, (counts.get(j.genre) ?? 0) + 1);
		return [...counts].sort((a, b) => b[1] - a[1]);
	});
	const languages = $derived([...new Set(studio.jobs.map((j) => j.language))].sort());
	const usedPresets = $derived(
		studio.presets.filter((p) => studio.jobs.some((j) => j.preset_id === p.id))
	);

	// ---- bulk selection
	let selected = $state(new Set<string>());
	let bulkValue = $state('');
	let confirmBulkDelete = $state(false);
	const visibleIds = $derived(results.map((j) => j.id));
	const selectedVisible = $derived(visibleIds.filter((id) => selected.has(id)));

	function select(id: string, on: boolean) {
		const next = new Set(selected);
		if (on) next.add(id);
		else next.delete(id);
		selected = next;
	}

	async function bulk(action: string) {
		const ids = selectedVisible;
		if (!ids.length) return;
		if (action === 'delete' && !confirmBulkDelete) {
			confirmBulkDelete = true;
			setTimeout(() => (confirmBulkDelete = false), 3000);
			return;
		}
		const needsValue = action.includes('category') || action.includes('flag');
		if (needsValue && !bulkValue.trim()) {
			studio.toast('Type a category or flag name first', 'error');
			return;
		}
		const res = await studio.attempt(() => api.bulk(ids, action, bulkValue));
		if (!res) return;
		studio.toast(`Updated ${ids.length} songs`);
		if (action === 'delete') selected = new Set();
		confirmBulkDelete = false;
	}
</script>

<div class="page">
	<div class="toolbar">
		<input
			class="search"
			type="search"
			placeholder="Search title, style, lyrics, tags…"
			value={f.q}
			oninput={(e) => set({ q: e.currentTarget.value })}
		/>
		<select value={f.sort} onchange={(e) => set({ sort: e.currentTarget.value as SortKey })} aria-label="Sort">
			{#each Object.entries(SORT_LABELS) as [k, label] (k)}<option value={k}>{label}</option>{/each}
		</select>
		<label class="inline"><input type="checkbox" checked={f.group} onchange={(e) => set({ group: e.currentTarget.checked })} /> Group by day</label>
		<div class="seg" role="group" aria-label="Layout">
			<button class:active={f.view === 'grid'} onclick={() => set({ view: 'grid' })}>Grid</button>
			<button class:active={f.view === 'list'} onclick={() => set({ view: 'list' })}>List</button>
		</div>
	</div>

	<div class="filters panel">
		<div class="frow">
			<span class="flabel">Show</span>
			<button class="chip" class:active={f.favorite} onclick={() => set({ favorite: !f.favorite })}>★ Favorites</button>
			{#each ['done', 'error', 'queued', 'running'] as s (s)}
				<button class="chip" class:active={f.status === s} onclick={() => set({ status: f.status === s ? '' : s })}>{s}</button>
			{/each}
			<span class="sep"></span>
			{#each languages as l (l)}
				<button class="chip" class:active={f.language === l} onclick={() => set({ language: f.language === l ? '' : l })}>
					{LANGUAGE_LABELS[l] ?? l}
				</button>
			{/each}
			<span class="sep"></span>
			{#each ['off', 'melody', 'full'] as c (c)}
				<button class="chip" class:active={f.cot === c} onclick={() => set({ cot: f.cot === c ? '' : c })}>cot {c}</button>
			{/each}
		</div>

		{#if studio.flags.length}
			<div class="frow">
				<span class="flabel">Flags</span>
				{#each studio.flags as fl (fl.id)}
					<button
						class="chip"
						class:active={f.flags.some((x) => x.toLowerCase() === fl.name.toLowerCase())}
						style:border-color={fl.color}
						onclick={() => set({ flags: toggle(f.flags, fl.name) })}>{fl.name}</button
					>
				{/each}
			</div>
		{/if}

		{#if studio.categories.length}
			<div class="frow">
				<span class="flabel">Categories</span>
				{#each studio.categories as c (c)}
					<button class="chip" class:active={f.categories.some((x) => x.toLowerCase() === c.toLowerCase())} onclick={() => set({ categories: toggle(f.categories, c) })}>{c}</button>
				{/each}
			</div>
		{/if}

		<div class="frow ranges">
			<label>Genre
				<select value={f.genre} onchange={(e) => set({ genre: e.currentTarget.value })}>
					<option value="">any</option>
					{#each genres as [g, n] (g)}<option value={g}>{g} ({n})</option>{/each}
				</select>
			</label>
			{#if usedPresets.length}
				<label>Preset
					<select value={f.preset} onchange={(e) => set({ preset: e.currentTarget.value })}>
						<option value="">any</option>
						{#each usedPresets as p (p.id)}<option value={String(p.id)}>{p.name}</option>{/each}
					</select>
				</label>
			{/if}
			<label>BPM
				<span class="pair">
					<input type="number" placeholder="min" value={f.bpmMin ?? ''} oninput={(e) => set({ bpmMin: e.currentTarget.value === '' ? null : Number(e.currentTarget.value) })} />
					<input type="number" placeholder="max" value={f.bpmMax ?? ''} oninput={(e) => set({ bpmMax: e.currentTarget.value === '' ? null : Number(e.currentTarget.value) })} />
				</span>
			</label>
			<label>Length (s)
				<span class="pair">
					<input type="number" placeholder="min" value={f.durMin ?? ''} oninput={(e) => set({ durMin: e.currentTarget.value === '' ? null : Number(e.currentTarget.value) })} />
					<input type="number" placeholder="max" value={f.durMax ?? ''} oninput={(e) => set({ durMax: e.currentTarget.value === '' ? null : Number(e.currentTarget.value) })} />
				</span>
			</label>
			<label>Created
				<span class="pair">
					<input type="date" value={f.from} onchange={(e) => set({ from: e.currentTarget.value })} />
					<input type="date" value={f.to} onchange={(e) => set({ to: e.currentTarget.value })} />
				</span>
			</label>
		</div>
		<FlagManager />
	</div>

	<div class="row summary">
		<strong>{results.length}</strong>
		<span class="muted">of {studio.jobs.length} songs</span>
		{#if activeFilterCount(f)}
			<button class="small ghost" onclick={() => set({ ...parseFilters(new URLSearchParams()), sort: f.sort, view: f.view, group: f.group })}>
				Clear {activeFilterCount(f)} filter{activeFilterCount(f) > 1 ? 's' : ''}
			</button>
		{/if}
		<span class="spacer"></span>
		{#if selectedVisible.length}
			<span class="muted">{selectedVisible.length} selected</span>
			<input class="bulk-input" placeholder="category / flag name" bind:value={bulkValue} />
			<button class="small" onclick={() => bulk('add-category')}>+ category</button>
			<button class="small" onclick={() => bulk('remove-category')}>− category</button>
			<button class="small" onclick={() => bulk('add-flag')}>+ flag</button>
			<button class="small" onclick={() => bulk('remove-flag')}>− flag</button>
			<button class="small" onclick={() => bulk('favorite')}>★</button>
			<button class="small" onclick={() => bulk('unfavorite')}>☆</button>
			<button class="small danger" class:confirm={confirmBulkDelete} onclick={() => bulk('delete')}>
				{confirmBulkDelete ? `Delete ${selectedVisible.length}?` : 'Delete'}
			</button>
			<button class="small ghost" onclick={() => (selected = new Set())}>Clear</button>
		{:else}
			<button class="small ghost" onclick={() => (selected = new Set(visibleIds))} disabled={!visibleIds.length}>Select all shown</button>
		{/if}
	</div>

	{#each groups as g (g.label)}
		{#if g.label}<h2 class="day">{g.label} <span class="faint">· {g.jobs.length}</span></h2>{/if}
		<div class={f.view}>
			{#each g.jobs as job (job.id)}
				<SongCard {job} layout={f.view} selectable selected={selected.has(job.id)} onselect={(on) => select(job.id, on)} />
			{/each}
		</div>
	{/each}
	{#if !results.length}<p class="muted">No songs match these filters.</p>{/if}
</div>

<style>
	.toolbar {
		display: flex;
		gap: 10px;
		align-items: center;
		flex-wrap: wrap;
		margin-bottom: 12px;
	}
	.search {
		flex: 1;
		min-width: 220px;
	}
	.toolbar select {
		width: auto;
	}
	.inline {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 0;
		font-size: 0.8rem;
		white-space: nowrap;
	}
	.seg {
		display: flex;
	}
	.seg button {
		border-radius: 0;
		font-size: 0.8rem;
	}
	.seg button:first-child {
		border-radius: 8px 0 0 8px;
	}
	.seg button:last-child {
		border-radius: 0 8px 8px 0;
		border-left: none;
	}
	.seg button.active {
		background: var(--accent-soft);
		color: var(--accent-hover);
	}
	.filters {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px 14px;
	}
	.frow {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: center;
	}
	.flabel {
		font-size: 0.72rem;
		color: var(--text-faint);
		width: 96px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.sep {
		width: 1px;
		height: 16px;
		background: var(--border-strong);
		margin: 0 4px;
	}
	.ranges {
		gap: 14px;
		align-items: flex-end;
	}
	.ranges label {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.ranges select {
		width: 200px;
		padding: 5px 8px;
	}
	.pair {
		display: flex;
		gap: 4px;
	}
	.pair input {
		width: 80px;
		padding: 5px 8px;
	}
	.pair input[type='date'] {
		width: 140px;
	}
	.summary {
		margin: 14px 0 8px;
	}
	.bulk-input {
		width: 170px;
		padding: 4px 8px;
		font-size: 0.8rem;
	}
	.confirm {
		border-color: var(--error);
		color: var(--error);
	}
	.day {
		font-size: 0.85rem;
		color: var(--text-dim);
		margin: 18px 0 8px;
		position: sticky;
		top: var(--nav-h);
		background: var(--bg);
		padding: 6px 0;
		z-index: 5;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		gap: 12px;
	}
	.list {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	@media (max-width: 700px) {
		.grid {
			grid-template-columns: 1fr;
		}
		.flabel {
			width: 100%;
		}
	}
</style>
