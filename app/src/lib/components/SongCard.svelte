<script lang="ts">
	import { goto } from '$app/navigation';
	import { api } from '$lib/client/api';
	import { estimateWallSeconds } from '$lib/client/eta';
	import { duration, dateTime, timeAgo } from '$lib/client/format';
	import { studio } from '$lib/client/studio.svelte';
	import { LANGUAGE_LABELS } from '$lib/detect';
	import TagEditor from './TagEditor.svelte';
	import type { Job } from '$lib/types';

	interface Props {
		job: Job;
		selectable?: boolean;
		selected?: boolean;
		onselect?: (checked: boolean) => void;
		layout?: 'grid' | 'list' | 'compact';
	}
	let { job, selectable = false, selected = false, onselect, layout = 'grid' }: Props = $props();

	let confirmDelete = $state(false);
	let showLyrics = $state(false);
	let now = $state(Date.now() / 1000);

	$effect(() => {
		if (job.status !== 'running') return;
		const t = setInterval(() => (now = Date.now() / 1000), 1000);
		return () => clearInterval(t);
	});

	const estimate = $derived(job.status === 'running' ? estimateWallSeconds(job, studio.jobs) : null);
	const elapsed = $derived(job.started_at ? Math.max(0, now - job.started_at) : 0);
	const eta = $derived(estimate !== null ? estimate - elapsed : null);
	const playing = $derived(studio.nowPlaying?.id === job.id);

	const update = (patch: Parameters<typeof api.updateJob>[1]) =>
		studio.attempt(() => api.updateJob(job.id, patch));

	function reuse(newSeed: boolean) {
		studio.draft = {
			title: job.title,
			style: job.style,
			lyrics: job.lyrics,
			cot: job.cot,
			seed: newSeed ? null : job.seed,
			cfg_scale: job.cfg_scale,
			target_seconds: job.target_seconds,
			categories: job.categories,
			flags: [],
			preset_id: job.preset_id
		};
		void goto('/generate');
	}

	async function regenerate() {
		await studio.attempt(
			() =>
				api.generate({
					title: job.title,
					style: job.style,
					lyrics: job.lyrics,
					cot: job.cot,
					seed: null,
					cfg_scale: job.cfg_scale,
					target_seconds: job.target_seconds,
					categories: job.categories,
					preset_id: job.preset_id
				}),
			'Queued a new take with a random seed'
		);
	}

	async function remove() {
		if (!confirmDelete) {
			confirmDelete = true;
			setTimeout(() => (confirmDelete = false), 3000);
			return;
		}
		const verb = job.status === 'running' ? 'Aborted and deleted' : job.status === 'queued' ? 'Removed from queue' : 'Deleted';
		await studio.attempt(() => api.deleteJob(job.id), verb);
	}

	const deleteLabel = $derived(
		job.status === 'running' ? 'Abort & delete' : job.status === 'queued' ? 'Cancel' : 'Delete'
	);
</script>

<article class="card {layout}" class:selected class:playing>
	<header>
		{#if selectable}
			<input type="checkbox" checked={selected} onchange={(e) => onselect?.(e.currentTarget.checked)} aria-label="Select" />
		{/if}
		<span class="badge {job.status}">{job.status}</span>
		<h3 title={job.title}>{job.title}</h3>
		<button
			class="ghost fav"
			class:on={job.favorite}
			onclick={() => update({ favorite: !job.favorite })}
			aria-label={job.favorite ? 'Unfavorite' : 'Favorite'}
			title="Favorite">{job.favorite ? '★' : '☆'}</button
		>
	</header>

	<p class="style" title={job.style}>{job.style}</p>

	<div class="meta faint">
		<span title={dateTime(job.created_at)}>{timeAgo(job.created_at)}</span>
		{#if job.duration_ms}<span title="Length">{duration(job.duration_ms)}</span>{/if}
		{#if job.bpm}<span>{job.bpm} BPM</span>{/if}
		<span>{LANGUAGE_LABELS[job.language] ?? job.language}</span>
		<span title="Planning mode">cot {job.cot}</span>
		<span title="Seed">#{job.seed}</span>
		{#if job.rtf}<span title="Generation time ÷ audio length">rtf {job.rtf.toFixed(2)}</span>{/if}
	</div>

	{#if job.status === 'running'}
		<p class="progress">
			Generating… {duration(elapsed * 1000)}
			{#if eta !== null && eta > 0}
				· ~{duration(eta * 1000)} left
			{:else if eta !== null}
				· taking longer than similar songs (long lyrics with melody/full planning, or another GPU job)
			{/if}
		</p>
	{:else if job.status === 'error'}
		<details class="err">
			<summary>Error</summary>
			<pre>{job.error_message}</pre>
		</details>
	{/if}

	{#if layout !== 'compact'}
	<div class="tagrows">
		<TagEditor
			values={job.categories}
			suggestions={studio.categories}
			placeholder="+ category"
			onchange={(categories) => update({ categories })}
		/>
		<TagEditor
			values={job.flags}
			suggestions={studio.flags.map((f) => f.name)}
			placeholder="+ flag"
			colorOf={(n) => studio.flagColor.get(n.toLowerCase())}
			onchange={(flags) => update({ flags })}
		/>
	</div>
	{/if}

	{#if showLyrics}<pre class="lyrics">{job.lyrics}</pre>{/if}

	<footer class="row">
		{#if job.status === 'done'}
			<button class="small primary" onclick={() => studio.play(job)}>{playing ? '▶ Playing' : '▶ Play'}</button>
		{/if}
		<button class="small" onclick={() => reuse(false)} title="Load into the Generate form (same seed)">Reuse</button>
		{#if layout !== 'compact'}
			<button class="small" onclick={regenerate} title="Queue again with a random seed">New take</button>
			<button class="small ghost" onclick={() => (showLyrics = !showLyrics)}>{showLyrics ? 'Hide' : 'Lyrics'}</button>
		{/if}
		<span class="spacer"></span>
		{#if job.status === 'done'}
			<a class="icon" href="{job.audio_url}?download" title="Download WAV" aria-label="Download">
				<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>
			</a>
			<button class="small ghost icon" onclick={() => studio.attempt(() => api.reveal(job.id))} title="Show in file manager" aria-label="Show in file manager">
				<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /></svg>
			</button>
		{/if}
		<button class="small danger" class:confirm={confirmDelete} class:abort={job.status === 'running'} onclick={remove}>
			{confirmDelete ? 'Confirm?' : deleteLabel}
		</button>
	</footer>
</article>

<style>
	.card {
		background: var(--panel);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 12px 14px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-width: 0;
	}
	.card.selected {
		border-color: var(--accent);
	}
	.card.playing {
		box-shadow: inset 3px 0 0 var(--accent);
	}
	header {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}
	h3 {
		margin: 0;
		font-size: 0.95rem;
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.badge {
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		padding: 1px 7px;
		border-radius: 999px;
		color: #0e0e12;
		font-weight: 700;
	}
	.badge.queued {
		background: var(--queued);
	}
	.badge.running {
		background: var(--running);
	}
	.badge.done {
		background: var(--done);
	}
	.badge.error {
		background: var(--error);
	}
	.fav {
		font-size: 1.1rem;
		padding: 0 4px;
		color: var(--text-faint);
	}
	.fav.on {
		color: #facc15;
	}
	.style {
		margin: 0;
		color: var(--text-dim);
		font-size: 0.8rem;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 12px;
		font-size: 0.72rem;
	}
	.progress {
		margin: 0;
		color: var(--running);
		font-size: 0.8rem;
	}
	.err summary {
		color: var(--error);
		cursor: pointer;
		font-size: 0.8rem;
	}
	.err pre,
	.lyrics {
		max-height: 220px;
		overflow: auto;
		margin: 4px 0 0;
	}
	.tagrows {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	footer {
		margin-top: auto;
		gap: 6px;
	}
	.icon {
		display: inline-flex;
		align-items: center;
		text-decoration: none;
		padding: 3px 5px;
		color: var(--text-dim);
	}
	.icon:hover {
		color: var(--text);
	}
	.confirm,
	.abort {
		border-color: var(--error);
		color: var(--error);
	}
	.card.compact {
		gap: 6px;
		padding: 10px 12px;
	}
	.card.compact .style {
		-webkit-line-clamp: 1;
		line-clamp: 1;
		font-size: 0.75rem;
	}
	.card.compact .meta span:nth-child(n + 5) {
		display: none;
	}
	.card.list {
		display: grid;
		grid-template-columns: minmax(200px, 1.2fr) minmax(200px, 2fr) auto;
		grid-template-areas:
			'head style foot'
			'meta tags foot';
		align-items: center;
		gap: 4px 16px;
		padding: 8px 12px;
	}
	.card.list header {
		grid-area: head;
	}
	.card.list .style {
		grid-area: style;
		-webkit-line-clamp: 1;
		line-clamp: 1;
	}
	.card.list .meta {
		grid-area: meta;
	}
	.card.list .tagrows {
		grid-area: tags;
		flex-direction: row;
		gap: 12px;
	}
	.card.list footer {
		grid-area: foot;
		margin: 0;
	}
	.card.list .progress,
	.card.list .err,
	.card.list .lyrics {
		grid-column: 1 / -1;
	}
	@media (max-width: 900px) {
		.card.list {
			display: flex;
		}
	}
</style>
