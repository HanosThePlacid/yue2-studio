<script lang="ts">
	import { studio } from '$lib/client/studio.svelte';

	const job = $derived(studio.nowPlaying);
</script>

{#if job?.audio_url}
	<div class="player">
		<div class="meta">
			<strong title={job.title}>{job.title}</strong>
			<span class="faint" title={job.style}>{job.style}</span>
		</div>
		{#key job.id}
			<audio src={job.audio_url} controls autoplay></audio>
		{/key}
		<button class="ghost" onclick={() => (studio.nowPlaying = null)} aria-label="Close player">✕</button>
	</div>
{/if}

<style>
	.player {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		height: var(--player-h);
		z-index: 30;
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 0 20px;
		background: var(--panel);
		border-top: 1px solid var(--border-strong);
	}
	.meta {
		display: flex;
		flex-direction: column;
		min-width: 0;
		width: 280px;
		flex-shrink: 1;
	}
	.meta > * {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.meta span {
		font-size: 0.75rem;
	}
	audio {
		flex: 1;
		min-width: 0;
		height: 40px;
	}
	@media (max-width: 700px) {
		.player {
			padding: 0 12px;
			gap: 8px;
		}
		.meta {
			width: 110px;
		}
	}
</style>
