<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import favicon from '$lib/assets/favicon.svg';
	import Player from '$lib/components/Player.svelte';
	import { studio } from '$lib/client/studio.svelte';

	let { children } = $props();

	const tabs = [
		{ href: '/generate', label: 'Generate' },
		{ href: '/gallery', label: 'Gallery' },
		{ href: '/styles', label: 'Styles' },
		{ href: '/guide', label: 'Guide' }
	];

	onMount(() => {
		void studio.start();
	});

	const running = $derived(studio.jobs.find((j) => j.status === 'running'));
	const queued = $derived(studio.jobs.filter((j) => j.status === 'queued').length);
	const version = $derived.by(() => {
		const v = studio.version;
		if (!v) return null;
		const label = [v.model, v.weights].filter(Boolean).join(' ') + (v.commit ? ` · audio.cpp ${v.commit}` : '');
		const title = [
			`Model: ${v.model}${v.weights ? ` (${v.weights})` : ''}`,
			`GGUF: ${v.gguf}`,
			v.engine && `Engine: ${v.engine}`,
			v.commit && `Commit: ${v.commit}${v.commit_date ? ` (${v.commit_date})` : ''}`
		]
			.filter(Boolean)
			.join('\n');
		return { label, title };
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>YuE2 Studio</title>
</svelte:head>

<nav class="topnav">
	<a class="brand" href="/generate">YuE2 Studio</a>
	{#each tabs as t (t.href)}
		<a href={t.href} class:active={page.url.pathname.startsWith(t.href)}>{t.label}</a>
	{/each}
	<span class="spacer"></span>
	{#if version}
		<span class="version" title={version.title}>{version.label}</span>
	{/if}
	{#if running || queued}
		<a class="queue-pill" href="/generate" title="Generation queue">
			<span class="dot"></span>
			{running ? 'Generating' : 'Queued'}{queued ? ` · ${queued} waiting` : ''}
		</a>
	{/if}
	{#if !studio.connected && studio.loaded}
		<span class="offline" title="Live updates disconnected, retrying…">offline</span>
	{/if}
</nav>

<div class="content" class:with-player={studio.nowPlaying}>
	{#if studio.loaded}
		{@render children()}
	{:else}
		<p class="page muted">Loading…</p>
	{/if}
</div>

<Player />

<div class="toasts">
	{#each studio.toasts as t (t.id)}
		<div class="toast" class:error={t.kind === 'error'}>{t.text}</div>
	{/each}
</div>

<style>
	.topnav {
		position: sticky;
		top: 0;
		z-index: 20;
		height: var(--nav-h);
		display: flex;
		align-items: center;
		gap: 18px;
		padding: 0 20px;
		background: var(--panel);
		border-bottom: 1px solid var(--border);
	}
	.topnav a {
		color: var(--text-dim);
		text-decoration: none;
		padding: 4px 2px;
		border-bottom: 2px solid transparent;
	}
	.topnav a:hover {
		color: var(--text);
	}
	.topnav a.active {
		color: var(--accent-hover);
		border-bottom-color: var(--accent);
	}
	.topnav .brand {
		font-weight: 700;
		color: var(--accent-hover);
		margin-right: 6px;
	}
	.spacer {
		flex: 1;
	}
	.queue-pill {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 0.8rem;
		border: 1px solid var(--border-strong) !important;
		border-radius: 999px;
		padding: 3px 10px !important;
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--running);
		animation: pulse 1.2s ease-in-out infinite;
	}
	@keyframes pulse {
		50% {
			opacity: 0.3;
		}
	}
	.version {
		font-size: 0.75rem;
		color: var(--text-dim);
		font-family: ui-monospace, monospace;
		white-space: nowrap;
	}
	.offline {
		font-size: 0.75rem;
		color: var(--error);
	}
	.content.with-player {
		padding-bottom: var(--player-h);
	}
	.toasts {
		position: fixed;
		right: 16px;
		bottom: calc(var(--player-h) + 12px);
		display: flex;
		flex-direction: column;
		gap: 8px;
		z-index: 50;
		max-width: min(420px, calc(100vw - 32px));
	}
	.toast {
		background: var(--panel-2);
		border: 1px solid var(--border-strong);
		border-left: 3px solid var(--accent);
		border-radius: 8px;
		padding: 10px 12px;
		font-size: 0.85rem;
		box-shadow: 0 6px 24px rgba(0, 0, 0, 0.4);
	}
	.toast.error {
		border-left-color: var(--error);
	}
	@media (max-width: 700px) {
		.topnav {
			gap: 12px;
			padding: 0 16px;
			overflow-x: auto;
		}
	}
</style>
