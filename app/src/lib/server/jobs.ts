import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { error } from '@sveltejs/kit';
import { OUTPUT_DIR } from './config';
import { detectBpm, detectGenre, detectLanguage } from '$lib/detect';
import {
	deleteJobRow,
	getJob,
	insertJob,
	patchJob,
	setJobCategories,
	setJobFlags,
	writeSidecar
} from './db';
import { emit } from './events';
import { audioFileFor } from './importer';
import { cancelRunning, enqueue, removeFromQueue } from './queue';
import type { Cot, GenerateInput, Job } from '$lib/types';

const COTS: Cot[] = ['off', 'melody', 'full'];

function optNumber(v: unknown, min: number, max: number, name: string): number | null {
	if (v === null || v === undefined || v === '') return null;
	const n = Number(v);
	if (!Number.isFinite(n) || n < min || n > max) error(400, `${name} must be between ${min} and ${max}`);
	return n;
}

export function createJob(input: GenerateInput): Job {
	const style = input.style?.trim();
	const lyrics = input.lyrics?.trim();
	if (!style) error(400, 'style is required');
	if (!lyrics) error(400, 'lyrics are required');
	const cot = input.cot ?? 'off';
	if (!COTS.includes(cot)) error(400, `cot must be one of ${COTS.join(', ')}`);

	const title = input.title?.trim() || 'Untitled';
	const id = `${Math.floor(Date.now() / 1000)}_${crypto.randomBytes(3).toString('hex')}`;
	const seed = optNumber(input.seed, 0, 2 ** 31 - 1, 'seed') ?? crypto.randomInt(2 ** 31);
	insertJob({
		id,
		title,
		style,
		lyrics,
		cot,
		seed: Math.floor(seed),
		cfg_scale: optNumber(input.cfg_scale, 0, 20, 'cfg_scale'),
		target_seconds: optNumber(input.target_seconds, 1, 600, 'target_seconds'),
		status: 'queued',
		error_message: null,
		created_at: Date.now() / 1000,
		example_id: input.example_id ?? null,
		preset_id: input.preset_id ?? null,
		favorite: false,
		language: detectLanguage(lyrics),
		bpm: detectBpm(style),
		genre: detectGenre(style),
		duration_ms: null,
		wall_ms: null,
		rtf: null,
		audio_file: audioFileFor(id, title)
	});
	if (input.categories?.length) setJobCategories(id, input.categories);
	if (input.flags?.length) setJobFlags(id, input.flags);
	const job = getJob(id)!;
	writeSidecar(job);
	emit({ type: 'job.created', job });
	enqueue(id);
	return job;
}

export interface JobUpdate {
	title?: string;
	favorite?: boolean;
	categories?: string[];
	flags?: string[];
	language?: string;
}

export function updateJob(id: string, u: JobUpdate): Job {
	if (!getJob(id)) error(404, 'job not found');
	patchJob(id, {
		title: u.title?.trim() || undefined,
		favorite: u.favorite,
		language: u.language,
		language_manual: u.language !== undefined ? true : undefined
	});
	if (u.categories) setJobCategories(id, u.categories);
	if (u.flags) setJobFlags(id, u.flags);
	const job = getJob(id)!;
	writeSidecar(job);
	emit({ type: 'job.updated', job });
	return job;
}

/** Delete a job and its files. A running job is aborted first (its process is killed). */
export async function deleteJob(id: string) {
	const job = getJob(id);
	if (!job) error(404, 'job not found');
	removeFromQueue(id);
	// Remove the row before killing, so the worker's exit handler finds nothing to mark as failed.
	deleteJobRow(id);
	if (job.status === 'running') await cancelRunning(id, job.audio_file);
	fs.rmSync(path.join(OUTPUT_DIR, job.audio_file), { force: true });
	fs.rmSync(path.join(OUTPUT_DIR, `${id}.json`), { force: true });
	emit({ type: 'job.deleted', id });
}
