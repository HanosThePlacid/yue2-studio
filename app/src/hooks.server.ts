import fs from 'node:fs';
import type { ServerInit } from '@sveltejs/kit';
import { OUTPUT_DIR } from '$lib/server/config';
import { db, refreshDerived } from '$lib/server/db';
import { importBuiltinPresets, importOutputJobs, importSongPrompts } from '$lib/server/importer';
import { resumeQueue } from '$lib/server/queue';

export const init: ServerInit = () => {
	fs.mkdirSync(OUTPUT_DIR, { recursive: true });
	db();
	const jobs = importOutputJobs();
	const presets = importSongPrompts() + importBuiltinPresets();
	if (jobs || presets) console.log(`[yue2] imported ${jobs} jobs, ${presets} presets`);
	refreshDerived();
	resumeQueue();
};
