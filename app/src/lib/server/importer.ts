import fs from 'node:fs';
import path from 'node:path';
import { OUTPUT_DIR, SONG_PROMPTS_DIR } from './config';
import { detectBpm, detectGenre, detectLanguage } from '$lib/detect';
import { db, insertJob, insertPreset, setJobCategories, setJobFlags, type PresetInput } from './db';
import type { Cot, JobStatus } from '$lib/types';

export function slugifyTitle(title: string): string {
	const cleaned = title
		.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
		.trim()
		.replace(/\s+/g, '_');
	return cleaned || 'untitled';
}

/** Same rule as the old app: legacy `{id}.wav` wins if it exists, else `{title}_{id}.wav`. */
export function audioFileFor(id: string, title: string): string {
	const legacy = `${id}.wav`;
	if (fs.existsSync(path.join(OUTPUT_DIR, legacy))) return legacy;
	return `${slugifyTitle(title)}_${id}.wav`;
}

interface LegacyJob {
	id: string;
	title: string;
	style: string;
	lyrics: string;
	cot?: Cot;
	seed: number;
	cfg_scale?: number | null;
	status: JobStatus;
	created_at: number;
	error_message?: string | null;
	metrics?: Record<string, number | string>;
	example_id?: string | null;
	target_seconds?: number | null;
	categories?: string[];
	favorite?: boolean;
	flags?: string[];
	language?: string;
	preset_id?: number | null;
}

export function importOutputJobs(): number {
	if (!fs.existsSync(OUTPUT_DIR)) return 0;
	let added = 0;
	const files = fs.readdirSync(OUTPUT_DIR).filter((f) => f.endsWith('.json')).sort();
	db().transaction(() => {
		for (const f of files) {
			let data: LegacyJob;
			try {
				data = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, f), 'utf8'));
			} catch {
				continue;
			}
			if (!data.id || !data.style) continue;
			const metrics = data.metrics ?? {};
			const num = (k: string) => (typeof metrics[k] === 'number' ? (metrics[k] as number) : null);
			// A job that was queued/running when the old server died never finished.
			const status: JobStatus =
				data.status === 'queued' || data.status === 'running' ? 'error' : data.status;
			const inserted = insertJob({
				id: data.id,
				title: data.title || 'Untitled',
				style: data.style,
				lyrics: data.lyrics ?? '',
				cot: data.cot ?? 'off',
				seed: data.seed,
				cfg_scale: data.cfg_scale ?? null,
				target_seconds: data.target_seconds ?? null,
				status,
				error_message:
					status !== data.status ? 'interrupted before finishing (imported)' : (data.error_message ?? null),
				created_at: data.created_at,
				example_id: data.example_id ?? null,
				preset_id: data.preset_id ?? null,
				favorite: !!data.favorite,
				language: data.language ?? detectLanguage(data.lyrics ?? ''),
				bpm: detectBpm(data.style),
				genre: detectGenre(data.style),
				duration_ms: num('audio_duration_ms'),
				wall_ms: num('wall_ms'),
				rtf: num('rtf'),
				metrics,
				audio_file: audioFileFor(data.id, data.title || 'Untitled')
			});
			if (!inserted) continue;
			added++;
			if (data.categories?.length) setJobCategories(data.id, data.categories);
			if (data.flags?.length) setJobFlags(data.id, data.flags);
		}
	})();
	return added;
}

// ---------------------------------------------------------------- song-prompts/*.md

function fencedAfter(md: string, label: RegExp): string | null {
	const m = md.match(label);
	if (!m || m.index === undefined) return null;
	const rest = md.slice(m.index + m[0].length);
	const fence = rest.match(/```[^\n]*\n([\s\S]*?)\n```/);
	return fence ? fence[1].trim() : null;
}

export function parsePromptMarkdown(md: string, relPath: string): PresetInput | null {
	const style = fencedAfter(md, /\*\*Style prompt:\*\*/i);
	if (!style) return null;
	const lyrics = fencedAfter(md, /\*\*Lyrics:\*\*/i) ?? '';
	const heading = md.match(/^#\s+(.+)$/m)?.[1].trim();
	const name = heading || path.basename(relPath, '.md').replace(/[-_]/g, ' ');
	const styleIdx = md.search(/\*\*Style prompt:\*\*/i);
	const notes = md
		.slice(0, styleIdx)
		.replace(/^#\s+.+$/m, '')
		.trim();
	const cotHint = md.match(/Planning mode\s*=\s*(off|melody|full)/i)?.[1].toLowerCase() as Cot | undefined;
	const lenHint = md.match(/Target length[^0-9~]*~?\s*(\d+)\s*s/i)?.[1];
	const folder = path.dirname(relPath);
	return {
		name,
		style,
		bpm: detectBpm(style),
		genre: detectGenre(style),
		tags: folder && folder !== '.' ? [folder] : [],
		notes,
		default_lyrics: lyrics,
		cot: cotHint ?? null,
		target_seconds: lenHint ? Number(lenHint) : null,
		source_file: relPath
	};
}

function walkMarkdown(dir: string, base = dir): string[] {
	if (!fs.existsSync(dir)) return [];
	return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
		const full = path.join(dir, e.name);
		if (e.isDirectory()) return walkMarkdown(full, base);
		return e.name.endsWith('.md') ? [path.relative(base, full)] : [];
	});
}

export function importSongPrompts(): number {
	let added = 0;
	for (const rel of walkMarkdown(SONG_PROMPTS_DIR)) {
		const parsed = parsePromptMarkdown(fs.readFileSync(path.join(SONG_PROMPTS_DIR, rel), 'utf8'), rel);
		if (parsed && insertPreset(parsed) !== null) added++;
	}
	return added;
}

// The old app's fixed Examples page, kept as built-in presets. Old example jobs get linked to them.
const DEMO_LYRICS =
	"[Verse]\nWe move through the night, chasing a feeling.\nHeartbeat and light, everything healing.\n" +
	"[Chorus]\nHold on to the sound, let it carry you now.\nHold on to the sound, we'll find our way somehow.";

const BUILTIN_EXAMPLES: [string, string, string][] = [
	['ballad_60', 'Slow Ballad', 'slow ballad, 60 BPM, soft piano, gentle strings, tender female vocal, intimate mix'],
	['lofi_80', 'Lo-Fi Chill', 'lo-fi hip hop, 80 BPM, vinyl crackle, mellow rhodes piano, laid-back male vocal, dusty warm mix'],
	['folk_90', 'Acoustic Folk', 'acoustic folk, 90 BPM, fingerpicked guitar, warm intimate vocal, light hand percussion'],
	['funk_110', 'Funk Groove', 'funk, 110 BPM, slap bass, tight horn section, energetic male vocal, groovy rhythm guitar'],
	['pop_128', 'Uptempo Pop', 'uptempo pop, 128 BPM, punchy synth bass, bright energetic female vocal, polished radio-ready mix'],
	['edm_128', 'EDM Festival', 'EDM festival anthem, 128 BPM, big room synths, sidechained pads, female vocal chops, huge drop'],
	['rock_140', 'Driving Rock', 'driving rock anthem, 140 BPM, distorted electric guitars, powerful male vocal, driving live drums'],
	['dnb_170', 'Drum & Bass', 'drum and bass, 170 BPM, rolling breakbeats, deep sub bass, atmospheric pads, ethereal vocal']
];

export function importBuiltinPresets(): number {
	let added = 0;
	const conn = db();
	const link = conn.prepare('UPDATE jobs SET preset_id = ? WHERE example_id = ? AND preset_id IS NULL');
	const find = conn.prepare('SELECT id FROM style_presets WHERE source_file = ?');
	for (const [exampleId, name, style] of BUILTIN_EXAMPLES) {
		const source = `builtin:${exampleId}`;
		if (
			insertPreset({
				name,
				style,
				bpm: detectBpm(style),
				genre: detectGenre(style),
				tags: ['examples'],
				notes: 'Built-in example from the original YuE2 Studio Examples page.',
				default_lyrics: DEMO_LYRICS,
				cot: null,
				target_seconds: null,
				source_file: source
			}) !== null
		)
			added++;
		link.run((find.get(source) as { id: number }).id, exampleId);
	}
	return added;
}

export function listSongPromptFiles(): string[] {
	return walkMarkdown(SONG_PROMPTS_DIR).sort();
}

export function readSongPromptFile(rel: string): PresetInput | null {
	const full = path.resolve(SONG_PROMPTS_DIR, rel);
	if (!full.startsWith(path.resolve(SONG_PROMPTS_DIR) + path.sep) || !fs.existsSync(full)) return null;
	return parsePromptMarkdown(fs.readFileSync(full, 'utf8'), rel);
}
