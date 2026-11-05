import fs from 'node:fs';
import path from 'node:path';
import { error, json } from '@sveltejs/kit';
import { OUTPUT_DIR } from '$lib/server/config';
import { getJob } from '$lib/server/db';
import { revealInExplorer } from '$lib/server/reveal';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params }) => {
	const job = getJob(params.id);
	if (!job) error(404, 'job not found');
	const wav = path.join(OUTPUT_DIR, job.audio_file);
	if (!fs.existsSync(wav)) error(404, 'audio file not found');
	try {
		await revealInExplorer(wav, true);
	} catch (e) {
		error(500, (e as Error).message);
	}
	return json({ ok: true });
};
