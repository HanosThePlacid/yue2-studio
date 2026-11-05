import { error, json } from '@sveltejs/kit';
import { OUTPUT_DIR } from '$lib/server/config';
import { revealInExplorer } from '$lib/server/reveal';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async () => {
	try {
		await revealInExplorer(OUTPUT_DIR, false);
	} catch (e) {
		error(500, (e as Error).message);
	}
	return json({ ok: true });
};
