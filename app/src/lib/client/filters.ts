import type { Job } from '$lib/types';

export type SortKey = 'newest' | 'oldest' | 'title' | 'duration' | 'bpm' | 'gentime' | 'favorite';

export interface Filters {
	q: string;
	categories: string[];
	flags: string[];
	favorite: boolean;
	language: string;
	status: string;
	cot: string;
	genre: string;
	preset: string;
	bpmMin: number | null;
	bpmMax: number | null;
	durMin: number | null; // seconds
	durMax: number | null;
	from: string; // yyyy-mm-dd
	to: string;
	sort: SortKey;
	view: 'grid' | 'list';
	group: boolean;
}

export const SORT_LABELS: Record<SortKey, string> = {
	newest: 'Newest first',
	oldest: 'Oldest first',
	title: 'Title A–Z',
	duration: 'Longest first',
	bpm: 'BPM (high → low)',
	gentime: 'Slowest generation first',
	favorite: 'Favorites first'
};

const num = (v: string | null) => (v === null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

export function parseFilters(p: URLSearchParams): Filters {
	const sort = p.get('sort') as SortKey | null;
	return {
		q: p.get('q') ?? '',
		categories: p.getAll('cat'),
		flags: p.getAll('flag'),
		favorite: p.get('fav') === '1',
		language: p.get('lang') ?? '',
		status: p.get('status') ?? '',
		cot: p.get('cot') ?? '',
		genre: p.get('genre') ?? '',
		preset: p.get('preset') ?? '',
		bpmMin: num(p.get('bpmMin')),
		bpmMax: num(p.get('bpmMax')),
		durMin: num(p.get('durMin')),
		durMax: num(p.get('durMax')),
		from: p.get('from') ?? '',
		to: p.get('to') ?? '',
		sort: sort && sort in SORT_LABELS ? sort : 'newest',
		view: p.get('view') === 'list' ? 'list' : 'grid',
		group: p.get('group') !== '0'
	};
}

export function toSearchParams(f: Filters): URLSearchParams {
	const p = new URLSearchParams();
	if (f.q) p.set('q', f.q);
	for (const c of f.categories) p.append('cat', c);
	for (const fl of f.flags) p.append('flag', fl);
	if (f.favorite) p.set('fav', '1');
	for (const k of ['language', 'status', 'cot', 'genre', 'preset', 'from', 'to'] as const) {
		const key = k === 'language' ? 'lang' : k;
		if (f[k]) p.set(key, f[k]);
	}
	for (const k of ['bpmMin', 'bpmMax', 'durMin', 'durMax'] as const) {
		if (f[k] !== null) p.set(k, String(f[k]));
	}
	if (f.sort !== 'newest') p.set('sort', f.sort);
	if (f.view !== 'grid') p.set('view', f.view);
	if (!f.group) p.set('group', '0');
	return p;
}

/** Count of active narrowing filters (not sort/view). */
export function activeFilterCount(f: Filters): number {
	return (
		(f.q ? 1 : 0) +
		f.categories.length +
		f.flags.length +
		(f.favorite ? 1 : 0) +
		[f.language, f.status, f.cot, f.genre, f.preset, f.from, f.to].filter(Boolean).length +
		[f.bpmMin, f.bpmMax, f.durMin, f.durMax].filter((v) => v !== null).length
	);
}

const lc = (s: string) => s.toLowerCase();

export function matches(job: Job, f: Filters): boolean {
	if (f.q) {
		const hay = lc(`${job.title}\n${job.style}\n${job.lyrics}\n${job.categories.join(' ')}\n${job.flags.join(' ')}`);
		if (!lc(f.q).split(/\s+/).filter(Boolean).every((w) => hay.includes(w))) return false;
	}
	const cats = job.categories.map(lc);
	if (!f.categories.every((c) => cats.includes(lc(c)))) return false;
	const flags = job.flags.map(lc);
	if (!f.flags.every((fl) => flags.includes(lc(fl)))) return false;
	if (f.favorite && !job.favorite) return false;
	if (f.language && job.language !== f.language) return false;
	if (f.status && job.status !== f.status) return false;
	if (f.cot && job.cot !== f.cot) return false;
	if (f.genre && job.genre !== f.genre) return false;
	if (f.preset && String(job.preset_id ?? '') !== f.preset) return false;
	if (f.bpmMin !== null && (job.bpm ?? -1) < f.bpmMin) return false;
	if (f.bpmMax !== null && (job.bpm ?? Infinity) > f.bpmMax) return false;
	const secs = job.duration_ms !== null ? job.duration_ms / 1000 : null;
	if (f.durMin !== null && (secs ?? -1) < f.durMin) return false;
	if (f.durMax !== null && (secs ?? Infinity) > f.durMax) return false;
	if (f.from && job.created_at < new Date(`${f.from}T00:00:00`).getTime() / 1000) return false;
	if (f.to && job.created_at >= new Date(`${f.to}T00:00:00`).getTime() / 1000 + 86400) return false;
	return true;
}

// Missing values always sort last, whatever the direction.
const desc = (a: number | null, b: number | null) =>
	a === null ? (b === null ? 0 : 1) : b === null ? -1 : b - a;

export function sortJobs(jobs: Job[], key: SortKey): Job[] {
	const out = [...jobs];
	const byNew = (a: Job, b: Job) => b.created_at - a.created_at;
	switch (key) {
		case 'oldest':
			return out.sort((a, b) => a.created_at - b.created_at);
		case 'title':
			return out.sort((a, b) => a.title.localeCompare(b.title) || byNew(a, b));
		case 'duration':
			return out.sort((a, b) => desc(a.duration_ms, b.duration_ms) || byNew(a, b));
		case 'bpm':
			return out.sort((a, b) => desc(a.bpm, b.bpm) || byNew(a, b));
		case 'gentime':
			return out.sort((a, b) => desc(a.wall_ms, b.wall_ms) || byNew(a, b));
		case 'favorite':
			return out.sort((a, b) => Number(b.favorite) - Number(a.favorite) || byNew(a, b));
		default:
			return out.sort(byNew);
	}
}
