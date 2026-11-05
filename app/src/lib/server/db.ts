import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { DB_PATH, OUTPUT_DIR } from './config';
import { detectBpm, detectGenre } from '$lib/detect';
import type { Cot, Flag, Job, JobStatus, Preset } from '$lib/types';

const SEP = '\u001f';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS jobs (
	id TEXT PRIMARY KEY,
	title TEXT NOT NULL,
	style TEXT NOT NULL,
	lyrics TEXT NOT NULL,
	cot TEXT NOT NULL DEFAULT 'off',
	seed INTEGER NOT NULL,
	cfg_scale REAL,
	target_seconds REAL,
	status TEXT NOT NULL,
	error_message TEXT,
	created_at REAL NOT NULL,
	started_at REAL,
	finished_at REAL,
	example_id TEXT,
	preset_id INTEGER,
	favorite INTEGER NOT NULL DEFAULT 0,
	language TEXT NOT NULL DEFAULT 'en',
	language_manual INTEGER NOT NULL DEFAULT 0,
	bpm INTEGER,
	genre TEXT NOT NULL DEFAULT 'unknown',
	duration_ms REAL,
	wall_ms REAL,
	rtf REAL,
	metrics_json TEXT NOT NULL DEFAULT '{}',
	audio_file TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS jobs_created ON jobs(created_at);
CREATE INDEX IF NOT EXISTS jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS jobs_favorite ON jobs(favorite);
CREATE INDEX IF NOT EXISTS jobs_language ON jobs(language);
CREATE INDEX IF NOT EXISTS jobs_bpm ON jobs(bpm);
CREATE INDEX IF NOT EXISTS jobs_duration ON jobs(duration_ms);
CREATE INDEX IF NOT EXISTS jobs_genre ON jobs(genre);

CREATE TABLE IF NOT EXISTS categories (
	id INTEGER PRIMARY KEY,
	name TEXT NOT NULL UNIQUE COLLATE NOCASE
);
CREATE TABLE IF NOT EXISTS job_categories (
	job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
	category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
	position INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY (job_id, category_id)
);

CREATE TABLE IF NOT EXISTS flags (
	id INTEGER PRIMARY KEY,
	name TEXT NOT NULL UNIQUE COLLATE NOCASE,
	color TEXT NOT NULL DEFAULT '#a855f7'
);
CREATE TABLE IF NOT EXISTS job_flags (
	job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
	flag_id INTEGER NOT NULL REFERENCES flags(id) ON DELETE CASCADE,
	PRIMARY KEY (job_id, flag_id)
);

CREATE TABLE IF NOT EXISTS style_presets (
	id INTEGER PRIMARY KEY,
	name TEXT NOT NULL,
	style TEXT NOT NULL,
	bpm INTEGER,
	genre TEXT NOT NULL DEFAULT 'unknown',
	tags TEXT NOT NULL DEFAULT '[]',
	notes TEXT NOT NULL DEFAULT '',
	default_lyrics TEXT NOT NULL DEFAULT '',
	cot TEXT,
	target_seconds REAL,
	source_file TEXT UNIQUE,
	created_at REAL NOT NULL
);
`;

const DEFAULT_FLAGS: [string, string][] = [
	['keeper', '#22c55e'],
	['redo', '#ef4444'],
	['final', '#a855f7'],
	['reference', '#3b82f6']
];

let _db: Database.Database | null = null;

export function db(): Database.Database {
	if (_db) return _db;
	fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
	const conn = new Database(DB_PATH);
	conn.pragma('journal_mode = WAL');
	conn.pragma('foreign_keys = ON');
	conn.exec(SCHEMA);
	const insertFlag = conn.prepare('INSERT OR IGNORE INTO flags (name, color) VALUES (?, ?)');
	if ((conn.prepare('SELECT COUNT(*) AS n FROM flags').get() as { n: number }).n === 0) {
		for (const [name, color] of DEFAULT_FLAGS) insertFlag.run(name, color);
	}
	_db = conn;
	return conn;
}

// ---------------------------------------------------------------- jobs

interface JobRow {
	id: string;
	title: string;
	style: string;
	lyrics: string;
	cot: Cot;
	seed: number;
	cfg_scale: number | null;
	target_seconds: number | null;
	status: JobStatus;
	error_message: string | null;
	created_at: number;
	started_at: number | null;
	finished_at: number | null;
	example_id: string | null;
	preset_id: number | null;
	favorite: number;
	language: string;
	bpm: number | null;
	genre: string;
	duration_ms: number | null;
	wall_ms: number | null;
	rtf: number | null;
	metrics_json: string;
	audio_file: string;
	cats: string | null;
	flgs: string | null;
}

const JOB_SELECT = `
SELECT j.*,
	(SELECT GROUP_CONCAT(name, '${SEP}') FROM (
		SELECT c.name FROM job_categories jc JOIN categories c ON c.id = jc.category_id
		WHERE jc.job_id = j.id ORDER BY jc.position)) AS cats,
	(SELECT GROUP_CONCAT(name, '${SEP}') FROM (
		SELECT f.name FROM job_flags jf JOIN flags f ON f.id = jf.flag_id
		WHERE jf.job_id = j.id ORDER BY f.name)) AS flgs
FROM jobs j`;

function rowToJob(r: JobRow): Job {
	return {
		id: r.id,
		title: r.title,
		style: r.style,
		lyrics: r.lyrics,
		cot: r.cot,
		seed: r.seed,
		cfg_scale: r.cfg_scale,
		target_seconds: r.target_seconds,
		status: r.status,
		error_message: r.error_message,
		created_at: r.created_at,
		started_at: r.started_at,
		finished_at: r.finished_at,
		example_id: r.example_id,
		preset_id: r.preset_id,
		favorite: !!r.favorite,
		language: r.language,
		bpm: r.bpm,
		genre: r.genre,
		duration_ms: r.duration_ms,
		wall_ms: r.wall_ms,
		rtf: r.rtf,
		metrics: JSON.parse(r.metrics_json || '{}'),
		audio_file: r.audio_file,
		audio_url: r.status === 'done' ? `/audio/${encodeURIComponent(r.audio_file)}` : null,
		categories: r.cats ? r.cats.split(SEP) : [],
		flags: r.flgs ? r.flgs.split(SEP) : []
	};
}

export function listJobs(): Job[] {
	return (db().prepare(`${JOB_SELECT} ORDER BY j.created_at DESC`).all() as JobRow[]).map(rowToJob);
}

export function getJob(id: string): Job | null {
	const row = db().prepare(`${JOB_SELECT} WHERE j.id = ?`).get(id) as JobRow | undefined;
	return row ? rowToJob(row) : null;
}

export function jobIdsWithStatus(statuses: JobStatus[]): string[] {
	const q = `SELECT id FROM jobs WHERE status IN (${statuses.map(() => '?').join(',')}) ORDER BY created_at`;
	return (db().prepare(q).all(...statuses) as { id: string }[]).map((r) => r.id);
}

export type NewJob = Omit<
	Job,
	'audio_url' | 'categories' | 'flags' | 'metrics' | 'started_at' | 'finished_at'
> & {
	metrics?: Record<string, number | string>;
	started_at?: number | null;
	finished_at?: number | null;
	language_manual?: boolean;
};

/** Insert a job; returns false if the id already exists. */
export function insertJob(j: NewJob): boolean {
	const res = db()
		.prepare(
			`INSERT OR IGNORE INTO jobs (id, title, style, lyrics, cot, seed, cfg_scale, target_seconds,
			status, error_message, created_at, started_at, finished_at, example_id, preset_id, favorite,
			language, language_manual, bpm, genre, duration_ms, wall_ms, rtf, metrics_json, audio_file)
			VALUES (@id, @title, @style, @lyrics, @cot, @seed, @cfg_scale, @target_seconds, @status,
			@error_message, @created_at, @started_at, @finished_at, @example_id, @preset_id, @favorite,
			@language, @language_manual, @bpm, @genre, @duration_ms, @wall_ms, @rtf, @metrics_json, @audio_file)`
		)
		.run({
			...j,
			started_at: j.started_at ?? null,
			finished_at: j.finished_at ?? null,
			favorite: j.favorite ? 1 : 0,
			language_manual: j.language_manual ? 1 : 0,
			metrics_json: JSON.stringify(j.metrics ?? {})
		});
	return res.changes > 0;
}

type JobPatch = Partial<{
	title: string;
	status: JobStatus;
	error_message: string | null;
	started_at: number | null;
	finished_at: number | null;
	favorite: boolean;
	language: string;
	language_manual: boolean;
	duration_ms: number | null;
	wall_ms: number | null;
	rtf: number | null;
	metrics: Record<string, number | string>;
}>;

export function patchJob(id: string, patch: JobPatch) {
	const cols: string[] = [];
	const vals: Record<string, unknown> = { id };
	for (const [k, v] of Object.entries(patch)) {
		if (v === undefined) continue;
		if (k === 'metrics') {
			cols.push('metrics_json = @metrics_json');
			vals.metrics_json = JSON.stringify(v);
		} else {
			cols.push(`${k} = @${k}`);
			vals[k] = typeof v === 'boolean' ? (v ? 1 : 0) : v;
		}
	}
	if (cols.length) db().prepare(`UPDATE jobs SET ${cols.join(', ')} WHERE id = @id`).run(vals);
}

/** Recompute style-derived columns so detector improvements apply to old rows too. */
export function refreshDerived() {
	const conn = db();
	conn.transaction(() => {
		for (const table of ['jobs', 'style_presets']) {
			const upd = conn.prepare(`UPDATE ${table} SET bpm = ?, genre = ? WHERE id = ?`);
			for (const r of conn.prepare(`SELECT id, style FROM ${table}`).all() as { id: string; style: string }[]) {
				upd.run(detectBpm(r.style), detectGenre(r.style), r.id);
			}
		}
	})();
}

export function deleteJobRow(id: string) {
	db().prepare('DELETE FROM jobs WHERE id = ?').run(id);
}

export function normalizeNames(names: string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of names) {
		const n = raw.trim();
		if (!n || seen.has(n.toLowerCase())) continue;
		seen.add(n.toLowerCase());
		out.push(n);
	}
	return out;
}

export const setJobCategories = (jobId: string, names: string[]) =>
	db().transaction(() => {
		const conn = db();
		conn.prepare('DELETE FROM job_categories WHERE job_id = ?').run(jobId);
		const ins = conn.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)');
		const get = conn.prepare('SELECT id FROM categories WHERE name = ?');
		const link = conn.prepare(
			'INSERT OR IGNORE INTO job_categories (job_id, category_id, position) VALUES (?, ?, ?)'
		);
		normalizeNames(names).forEach((name, i) => {
			ins.run(name);
			link.run(jobId, (get.get(name) as { id: number }).id, i);
		});
		conn.prepare('DELETE FROM categories WHERE id NOT IN (SELECT category_id FROM job_categories)').run();
	})();

export const setJobFlags = (jobId: string, names: string[]) =>
	db().transaction(() => {
		const conn = db();
		conn.prepare('DELETE FROM job_flags WHERE job_id = ?').run(jobId);
		const ins = conn.prepare('INSERT OR IGNORE INTO flags (name) VALUES (?)');
		const get = conn.prepare('SELECT id FROM flags WHERE name = ?');
		const link = conn.prepare('INSERT OR IGNORE INTO job_flags (job_id, flag_id) VALUES (?, ?)');
		for (const name of normalizeNames(names)) {
			ins.run(name);
			link.run(jobId, (get.get(name) as { id: number }).id);
		}
	})();

/**
 * Sidecar JSON in output/, same shape the old FastAPI app wrote. Keeps output/ self-describing
 * (backup, and lets the SQLite DB be rebuilt from scratch by the importer).
 */
export function writeSidecar(job: Job) {
	const data = {
		id: job.id,
		title: job.title,
		style: job.style,
		lyrics: job.lyrics,
		cot: job.cot,
		seed: job.seed,
		cfg_scale: job.cfg_scale,
		status: job.status,
		created_at: job.created_at,
		error_message: job.error_message,
		metrics: job.metrics,
		example_id: job.example_id,
		target_seconds: job.target_seconds,
		categories: job.categories,
		favorite: job.favorite,
		flags: job.flags,
		language: job.language,
		preset_id: job.preset_id
	};
	fs.writeFileSync(path.join(OUTPUT_DIR, `${job.id}.json`), JSON.stringify(data, null, 2));
}

// ---------------------------------------------------------------- flags

export function listFlags(): Flag[] {
	return db().prepare('SELECT id, name, color FROM flags ORDER BY name').all() as Flag[];
}

export function upsertFlag(name: string, color: string): Flag {
	const conn = db();
	conn
		.prepare('INSERT INTO flags (name, color) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET color = excluded.color')
		.run(name.trim(), color);
	return conn.prepare('SELECT id, name, color FROM flags WHERE name = ?').get(name.trim()) as Flag;
}

/** Deletes the flag everywhere; returns the ids of jobs that carried it. */
export function deleteFlag(id: number): string[] {
	const conn = db();
	const ids = (conn.prepare('SELECT job_id FROM job_flags WHERE flag_id = ?').all(id) as { job_id: string }[]).map(
		(r) => r.job_id
	);
	conn.prepare('DELETE FROM flags WHERE id = ?').run(id);
	return ids;
}

export function listCategories(): string[] {
	return (db().prepare('SELECT name FROM categories ORDER BY name').all() as { name: string }[]).map(
		(r) => r.name
	);
}

// ---------------------------------------------------------------- presets

interface PresetRow extends Omit<Preset, 'tags'> {
	tags: string;
}

const rowToPreset = (r: PresetRow): Preset => ({ ...r, tags: JSON.parse(r.tags || '[]') });

export function listPresets(): Preset[] {
	return (db().prepare('SELECT * FROM style_presets ORDER BY name').all() as PresetRow[]).map(
		rowToPreset
	);
}

export function getPreset(id: number): Preset | null {
	const r = db().prepare('SELECT * FROM style_presets WHERE id = ?').get(id) as PresetRow | undefined;
	return r ? rowToPreset(r) : null;
}

export type PresetInput = Omit<Preset, 'id' | 'created_at'>;

/** Insert; returns the new id, or null when source_file collides (re-import leaves the row alone). */
export function insertPreset(p: PresetInput): number | null {
	const res = db()
		.prepare(
			`INSERT OR IGNORE INTO style_presets
			(name, style, bpm, genre, tags, notes, default_lyrics, cot, target_seconds, source_file, created_at)
			VALUES (@name, @style, @bpm, @genre, @tags, @notes, @default_lyrics, @cot, @target_seconds, @source_file, @created_at)`
		)
		.run({ ...p, tags: JSON.stringify(p.tags), created_at: Date.now() / 1000 });
	return res.changes > 0 ? Number(res.lastInsertRowid) : null;
}

export function updatePreset(id: number, p: PresetInput) {
	db()
		.prepare(
			`UPDATE style_presets SET name=@name, style=@style, bpm=@bpm, genre=@genre, tags=@tags,
			notes=@notes, default_lyrics=@default_lyrics, cot=@cot, target_seconds=@target_seconds
			WHERE id=@id`
		)
		.run({ ...p, id, tags: JSON.stringify(p.tags) });
}

export function deletePreset(id: number) {
	db().prepare('DELETE FROM style_presets WHERE id = ?').run(id);
}
