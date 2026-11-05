<script lang="ts">
	import Composer from '$lib/components/Composer.svelte';
	import SongCard from '$lib/components/SongCard.svelte';
	import { studio } from '$lib/client/studio.svelte';

	const RECENT = 40;

	const active = $derived(
		studio.jobs
			.filter((j) => j.status === 'running' || j.status === 'queued')
			.sort((a, b) => (a.status === 'running' ? -1 : b.status === 'running' ? 1 : a.created_at - b.created_at))
	);
	const recent = $derived(
		studio.jobs.filter((j) => j.status === 'done' || j.status === 'error').slice(0, RECENT)
	);
</script>

<div class="layout" class:with-player={studio.nowPlaying}>
	<section class="panel main">
		<Composer />
	</section>

	<aside class="side">
		{#if active.length}
			<h2>Queue <span class="faint">· {active.length}</span></h2>
			<div class="list">
				{#each active as job (job.id)}<SongCard {job} layout="compact" />{/each}
			</div>
		{/if}
		<div class="row head">
			<h2>Recent</h2>
			<span class="spacer"></span>
			<a href="/gallery">All {studio.jobs.length} →</a>
		</div>
		<div class="list">
			{#each recent as job (job.id)}
				<SongCard {job} layout="compact" />
			{:else}
				<p class="muted">Nothing generated yet.</p>
			{/each}
		</div>
	</aside>
</div>

<style>
	/* Fill the viewport: composer 3/4, recent column 1/4, each scrolling on its own. */
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 3fr) minmax(0, 1fr);
		gap: 16px;
		padding: 16px 20px;
		height: calc(100vh - var(--nav-h));
	}
	.layout.with-player {
		height: calc(100vh - var(--nav-h) - var(--player-h));
	}
	.main {
		min-width: 0;
		min-height: 0;
		overflow: hidden;
	}
	.side {
		min-width: 0;
		min-height: 0;
		overflow-y: auto;
		padding-right: 4px;
	}
	.side h2 {
		margin: 4px 0 8px;
	}
	.head {
		margin-top: 8px;
	}
	.head h2 {
		margin: 0;
	}
	.list {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 12px;
	}
	@media (max-width: 1100px) {
		.layout {
			grid-template-columns: 1fr;
			height: auto;
			padding: 12px 16px;
		}
		.main {
			overflow: visible;
		}
		.side {
			overflow: visible;
		}
	}
</style>
