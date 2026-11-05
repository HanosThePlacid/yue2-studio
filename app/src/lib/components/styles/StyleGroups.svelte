<script lang="ts">
	import { duration } from '$lib/client/format';
	import { studio } from '$lib/client/studio.svelte';
	import type { Job } from '$lib/types';

	let by = $state<'genre' | 'preset'>('genre');

	interface Group {
		key: string;
		label: string;
		href: string;
		jobs: Job[];
	}

	const groups = $derived.by((): Group[] => {
		const map = new Map<string, Group>();
		for (const j of studio.jobs) {
			let key: string, label: string, href: string;
			if (by === 'genre') {
				key = label = j.genre;
				href = `/gallery?genre=${encodeURIComponent(j.genre)}`;
			} else {
				if (!j.preset_id) continue;
				key = String(j.preset_id);
				label = studio.presets.find((p) => p.id === j.preset_id)?.name ?? `Preset #${j.preset_id}`;
				href = `/gallery?preset=${j.preset_id}`;
			}
			if (!map.has(key)) map.set(key, { key, label, href, jobs: [] });
			map.get(key)!.jobs.push(j);
		}
		return [...map.values()].sort((a, b) => b.jobs.length - a.jobs.length || a.label.localeCompare(b.label));
	});

	const stats = (jobs: Job[]) => {
		const done = jobs.filter((j) => j.status === 'done');
		const total = done.reduce((s, j) => s + (j.duration_ms ?? 0), 0);
		const bpms = jobs.map((j) => j.bpm).filter((b): b is number => b !== null);
		return {
			favorites: jobs.filter((j) => j.favorite).length,
			total,
			bpm: bpms.length ? `${Math.min(...bpms)}–${Math.max(...bpms)}` : null,
			latest: jobs.reduce((a, b) => (a.created_at > b.created_at ? a : b))
		};
	};
</script>

<div class="row bar">
	<span class="muted">Group songs by</span>
	<button class="chip" class:active={by === 'genre'} onclick={() => (by = 'genre')}>Genre</button>
	<button class="chip" class:active={by === 'preset'} onclick={() => (by = 'preset')}>Preset</button>
</div>

<div class="grid">
	{#each groups as g (g.key)}
		{@const s = stats(g.jobs)}
		<a class="panel group" href={g.href}>
			<div class="row">
				<strong>{g.label}</strong>
				<span class="spacer"></span>
				<span class="count">{g.jobs.length}</span>
			</div>
			<div class="row faint meta">
				{#if s.bpm}<span>{s.bpm} BPM</span>{/if}
				<span>{duration(s.total)} total</span>
				{#if s.favorites}<span>★ {s.favorites}</span>{/if}
			</div>
			<span class="latest faint" title={s.latest.style}>latest: {s.latest.title}</span>
		</a>
	{:else}
		<p class="muted">{by === 'preset' ? 'No songs were generated from a preset yet.' : 'No songs yet.'}</p>
	{/each}
</div>

<style>
	.bar {
		margin-bottom: 12px;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: 10px;
	}
	.group {
		display: flex;
		flex-direction: column;
		gap: 6px;
		color: var(--text);
		text-decoration: none;
		padding: 12px 14px;
	}
	.group:hover {
		border-color: var(--accent);
	}
	.count {
		font-size: 1.2rem;
		font-weight: 700;
		color: var(--accent-hover);
	}
	.meta {
		font-size: 0.75rem;
		gap: 10px;
	}
	.latest {
		font-size: 0.72rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
