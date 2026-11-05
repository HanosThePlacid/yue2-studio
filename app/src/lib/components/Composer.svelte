<script lang="ts">
	import { onMount } from 'svelte';
	import { api } from '$lib/client/api';
	import { studio } from '$lib/client/studio.svelte';
	import TagEditor from './TagEditor.svelte';
	import type { Cot, GenerateInput } from '$lib/types';

	const STORAGE_KEY = 'yue2.composer';
	const SECTION_TAGS = ['[Intro]', '[Verse]', '[Pre-Chorus]', '[Chorus]', '[Bridge]', '[Interlude]', '[Outro]'];

	let title = $state('');
	let style = $state('');
	let lyrics = $state('');
	let categories = $state<string[]>([]);
	let flags = $state<string[]>([]);
	let seed = $state<number | null>(null);
	let cot = $state<Cot>('off');
	let cfgScale = $state<number | null>(null);
	let targetSeconds = $state<number | null>(null);
	let presetId = $state<number | null>(null);
	let busy = $state(false);
	let files = $state<string[]>([]);
	let lyricsEl: HTMLTextAreaElement | undefined = $state();

	function apply(d: Partial<GenerateInput>) {
		if (d.title !== undefined) title = d.title;
		if (d.style !== undefined) style = d.style;
		if (d.lyrics !== undefined) lyrics = d.lyrics;
		if (d.categories !== undefined) categories = [...d.categories];
		if (d.flags !== undefined) flags = [...d.flags];
		if (d.seed !== undefined) seed = d.seed;
		if (d.cot !== undefined) cot = d.cot;
		if (d.cfg_scale !== undefined) cfgScale = d.cfg_scale;
		if (d.target_seconds !== undefined) targetSeconds = d.target_seconds;
		if (d.preset_id !== undefined) presetId = d.preset_id;
	}

	const snapshot = (): GenerateInput => ({
		title,
		style,
		lyrics,
		categories,
		flags,
		seed,
		cot,
		cfg_scale: cfgScale,
		target_seconds: targetSeconds,
		preset_id: presetId
	});

	onMount(() => {
		// A pending Reuse/Use-preset draft wins over the remembered form (applied by the effect below).
		if (!studio.draft) {
			try {
				const saved = localStorage.getItem(STORAGE_KEY);
				if (saved) apply(JSON.parse(saved));
			} catch {
				// storage unavailable; start empty
			}
		}
		void api.songPromptFiles().then((f) => (files = f)).catch(() => {});
	});

	// "Reuse" / "Use preset" set studio.draft, possibly while this form is already on screen
	// (e.g. Reuse on a card in the Generate tab's Recent column), so watch it rather than read once.
	$effect(() => {
		const d = studio.draft;
		if (!d) return;
		apply(d);
		studio.draft = null;
	});

	// Remember the unsent form per browser, so a refresh doesn't lose a long lyric.
	$effect(() => {
		const s = JSON.stringify(snapshot());
		try {
			localStorage.setItem(STORAGE_KEY, s);
		} catch {
			// ignore
		}
	});

	function loadPreset(idStr: string) {
		const p = studio.presets.find((x) => x.id === Number(idStr));
		if (!p) return;
		apply({
			title: title || p.name,
			style: p.style,
			lyrics: p.default_lyrics || lyrics,
			cot: p.cot ?? cot,
			target_seconds: p.target_seconds ?? targetSeconds,
			preset_id: p.id
		});
	}

	async function loadFile(file: string) {
		if (!file) return;
		const p = await studio.attempt(() => api.songPromptFile(file));
		if (!p) return;
		apply({
			title: p.name,
			style: p.style,
			lyrics: p.default_lyrics,
			cot: p.cot ?? cot,
			target_seconds: p.target_seconds ?? targetSeconds,
			preset_id: studio.presets.find((x) => x.source_file === file)?.id ?? null
		});
	}

	function insertTag(tag: string) {
		const el = lyricsEl;
		if (!el) return;
		const start = el.selectionStart;
		const before = lyrics.slice(0, start);
		const prefix = before && !before.endsWith('\n') ? '\n' : '';
		const text = `${prefix}${tag}\n`;
		lyrics = before + text + lyrics.slice(el.selectionEnd);
		const pos = start + text.length;
		requestAnimationFrame(() => {
			el.focus();
			el.setSelectionRange(pos, pos);
		});
	}

	async function submit() {
		busy = true;
		const res = await studio.attempt(() => api.generate(snapshot()), 'Queued');
		busy = false;
		if (res && seed !== null) seed = null; // next take gets a fresh seed unless re-pinned
	}

	const lineCount = $derived(lyrics.split('\n').filter((l) => l.trim() && !l.trim().startsWith('[')).length);
</script>

<form
	class="composer"
	onsubmit={(e) => {
		e.preventDefault();
		void submit();
	}}
>
	<div class="settings">
		<h1>Create</h1>

		<div class="row loaders">
			<select value="" onchange={(e) => loadPreset(e.currentTarget.value)} aria-label="Load style preset">
				<option value="" disabled>Load preset…</option>
				{#each studio.presets as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
			</select>
			<select value="" onchange={(e) => loadFile(e.currentTarget.value)} aria-label="Load song-prompts file">
				<option value="" disabled>From song-prompts…</option>
				{#each files as f (f)}<option value={f}>{f}</option>{/each}
			</select>
		</div>

		<label for="title">Title</label>
		<input id="title" bind:value={title} placeholder="My Song" />

		<label for="style">Style / tags</label>
		<textarea id="style" rows="6" bind:value={style} placeholder="genre, BPM, instruments, vocal type, mood, mix"></textarea>

		<div class="grid2">
			<div>
				<label for="seed">Seed (blank = random)</label>
				<div class="row nowrap">
					<input id="seed" type="number" min="0" bind:value={seed} placeholder="random" />
					<button type="button" onclick={() => (seed = Math.floor(Math.random() * 2147483647))} title="Randomize">Random</button>
				</div>
			</div>
			<div>
				<label for="cot">Planning mode</label>
				<select id="cot" bind:value={cot}>
					<option value="off">off (fastest)</option>
					<option value="melody">melody</option>
					<option value="full">full</option>
				</select>
			</div>
			<div>
				<label for="len">Target length, seconds</label>
				<input id="len" type="number" min="1" max="600" bind:value={targetSeconds} placeholder="default range" />
			</div>
			<div>
				<label for="cfg">CFG scale</label>
				<input id="cfg" type="number" step="0.1" min="0" max="20" bind:value={cfgScale} placeholder="default" />
			</div>
		</div>

		<span class="label">Categories</span>
		<TagEditor values={categories} suggestions={studio.categories} placeholder="+ category" onchange={(v) => (categories = v)} />
		<span class="label">Flags</span>
		<TagEditor
			values={flags}
			suggestions={studio.flags.map((f) => f.name)}
			placeholder="+ flag"
			colorOf={(n) => studio.flagColor.get(n.toLowerCase())}
			onchange={(v) => (flags = v)}
		/>

		<button type="submit" class="primary create" disabled={busy || !style.trim() || !lyrics.trim()}>
			{busy ? 'Queuing…' : 'Create'}
		</button>
	</div>

	<div class="lyrics-col">
		<label for="lyrics">Lyrics <span class="faint">· {lineCount} lines</span></label>
		<div class="row tagbar">
			{#each SECTION_TAGS as t (t)}
				<button type="button" class="chip" onclick={() => insertTag(t)}>{t}</button>
			{/each}
		</div>
		<textarea id="lyrics" bind:this={lyricsEl} bind:value={lyrics} placeholder={'[Verse]\nLine one\nLine two\n[Chorus]\n…'}></textarea>
	</div>
</form>

<style>
	.composer {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
		gap: 24px;
		height: 100%;
		min-height: 0;
	}
	.settings {
		display: flex;
		flex-direction: column;
		min-width: 0;
		overflow-y: auto;
		padding-right: 4px;
	}
	.lyrics-col {
		display: flex;
		flex-direction: column;
		min-width: 0;
		min-height: 0;
	}
	.lyrics-col label {
		margin-top: 0;
	}
	#lyrics {
		flex: 1;
		min-height: 360px;
		resize: none;
		font-size: 0.9rem;
		line-height: 1.55;
	}
	.loaders select {
		flex: 1 1 0;
		min-width: 0;
		font-size: 0.8rem;
	}
	.grid2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0 12px;
	}
	.tagbar {
		gap: 4px;
		margin-bottom: 6px;
	}
	.nowrap {
		flex-wrap: nowrap;
	}
	.create {
		margin-top: 18px;
		padding: 11px;
		font-size: 1rem;
	}
	@media (max-width: 1100px) {
		.composer {
			grid-template-columns: 1fr;
			height: auto;
		}
		.settings {
			overflow: visible;
		}
	}
</style>
