<script lang="ts">
	import { api } from '$lib/client/api';
	import { dateTime } from '$lib/client/format';
	import { studio } from '$lib/client/studio.svelte';
	import SongCard from '$lib/components/SongCard.svelte';
	import type { Cot, Job } from '$lib/types';

	const DEFAULT_LYRICS =
		"[Verse]\nWe move through the night, chasing a feeling.\nHeartbeat and light, everything healing.\n[Chorus]\nHold on to the sound, let it carry you now.\nHold on to the sound, we'll find our way somehow.";

	let lyrics = $state(DEFAULT_LYRICS);
	let seed = $state<number>(Math.floor(Math.random() * 2147483647));
	let cot = $state<Cot>('off');
	let targetSeconds = $state<number | null>(30);
	let picked = $state(new Set<number>());
	let filter = $state('');
	let busy = $state(false);

	const choices = $derived(
		studio.presets.filter((p) => !filter || `${p.name} ${p.style}`.toLowerCase().includes(filter.toLowerCase()))
	);

	function toggle(id: number) {
		const next = new Set(picked);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		picked = next;
	}

	async function run() {
		const runId = `cmp:${Date.now().toString(36)}`;
		busy = true;
		let queued = 0;
		for (const id of picked) {
			const p = studio.presets.find((x) => x.id === id);
			if (!p) continue;
			const ok = await studio.attempt(() =>
				api.generate({
					title: `Compare · ${p.name}`,
					style: p.style,
					lyrics,
					seed,
					cot,
					target_seconds: targetSeconds,
					example_id: runId,
					preset_id: p.id
				})
			);
			if (!ok) break;
			queued++;
		}
		busy = false;
		if (queued) studio.toast(`Queued ${queued} takes with seed ${seed}`);
		if (queued === picked.size) picked = new Set();
	}

	// Past comparisons: jobs sharing an example_id. Legacy Examples-page jobs form one group.
	const runs = $derived.by(() => {
		const byRun = new Map<string, Job[]>();
		for (const j of studio.jobs) {
			if (!j.example_id) continue;
			const key = j.example_id.startsWith('cmp:') ? j.example_id : 'legacy-examples';
			if (!byRun.has(key)) byRun.set(key, []);
			byRun.get(key)!.push(j);
		}
		return [...byRun.entries()]
			.map(([id, jobs]) => ({ id, jobs, at: Math.max(...jobs.map((j) => j.created_at)) }))
			.sort((a, b) => b.at - a.at);
	});
</script>

<div class="layout">
	<section class="panel setup">
		<h2>New comparison</h2>
		<p class="muted small">Same lyrics and seed, different style presets. Listen side by side to hear what each style prompt changes.</p>
		<label for="cl">Lyrics</label>
		<textarea id="cl" rows="6" bind:value={lyrics}></textarea>
		<div class="row">
			<div class="f">
				<label for="cs">Seed (shared)</label>
				<input id="cs" type="number" bind:value={seed} />
			</div>
			<div class="f">
				<label for="cc">Planning</label>
				<select id="cc" bind:value={cot}>
					<option value="off">off</option>
					<option value="melody">melody</option>
					<option value="full">full</option>
				</select>
			</div>
			<div class="f">
				<label for="ct">Length (s)</label>
				<input id="ct" type="number" min="1" max="600" bind:value={targetSeconds} />
			</div>
		</div>
		<label for="cf">Presets to compare ({picked.size} picked)</label>
		<input id="cf" type="search" placeholder="filter…" bind:value={filter} />
		<div class="choices">
			{#each choices as p (p.id)}
				<label class="choice">
					<input type="checkbox" checked={picked.has(p.id)} onchange={() => toggle(p.id)} />
					<span>{p.name}</span>
					{#if p.bpm}<span class="faint">{p.bpm}</span>{/if}
				</label>
			{/each}
		</div>
		<button class="primary go" disabled={busy || picked.size < 2 || !lyrics.trim()} onclick={run}>
			{busy ? 'Queuing…' : `Generate ${picked.size} takes`}
		</button>
	</section>

	<section class="runs">
		{#each runs as r (r.id)}
			<h2>
				{r.id === 'legacy-examples' ? 'Original Examples page' : `Comparison · ${dateTime(r.at)}`}
				<span class="faint">· {r.jobs.length} takes{r.jobs[0] ? ` · seed ${r.jobs[0].seed}` : ''}</span>
			</h2>
			<div class="grid">
				{#each r.jobs as job (job.id)}<SongCard {job} />{/each}
			</div>
		{:else}
			<p class="muted">No comparisons yet.</p>
		{/each}
	</section>
</div>

<style>
	.layout {
		display: grid;
		grid-template-columns: minmax(300px, 380px) 1fr;
		gap: 20px;
		align-items: start;
	}
	.setup h2 {
		margin-top: 0;
	}
	.small {
		font-size: 0.8rem;
	}
	.f {
		flex: 1;
		min-width: 90px;
	}
	.choices {
		max-height: 320px;
		overflow-y: auto;
		border: 1px solid var(--border);
		border-radius: 8px;
		margin-top: 6px;
		padding: 4px;
	}
	.choice {
		display: flex;
		gap: 8px;
		align-items: center;
		margin: 0;
		padding: 4px 6px;
		font-size: 0.82rem;
		color: var(--text);
		cursor: pointer;
		border-radius: 6px;
	}
	.choice:hover {
		background: var(--panel-2);
	}
	.choice span:nth-child(2) {
		flex: 1;
	}
	.go {
		width: 100%;
		margin-top: 12px;
		padding: 9px;
	}
	.runs {
		min-width: 0;
	}
	.runs h2:first-child {
		margin-top: 0;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 12px;
	}
	@media (max-width: 900px) {
		.layout {
			grid-template-columns: 1fr;
		}
	}
</style>
