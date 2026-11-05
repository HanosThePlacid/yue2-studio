import { error } from '@sveltejs/kit';
import { detectBpm, detectGenre } from '$lib/detect';
import type { PresetInput } from './db';
import type { Cot } from '$lib/types';

/** Validate a preset payload from the client; bpm/genre are derived from the style when absent. */
export function presetFromBody(b: Record<string, unknown>): PresetInput {
	const name = String(b.name ?? '').trim();
	const style = String(b.style ?? '').trim();
	if (!name) error(400, 'name required');
	if (!style) error(400, 'style required');
	const cot = b.cot === 'off' || b.cot === 'melody' || b.cot === 'full' ? (b.cot as Cot) : null;
	const target = b.target_seconds === null || b.target_seconds === '' || b.target_seconds === undefined
		? null
		: Number(b.target_seconds);
	return {
		name,
		style,
		bpm: detectBpm(style),
		genre: String(b.genre ?? '').trim() || detectGenre(style),
		tags: Array.isArray(b.tags) ? b.tags.map(String).map((t) => t.trim()).filter(Boolean) : [],
		notes: String(b.notes ?? ''),
		default_lyrics: String(b.default_lyrics ?? ''),
		cot,
		target_seconds: target !== null && Number.isFinite(target) ? target : null,
		source_file: null
	};
}
