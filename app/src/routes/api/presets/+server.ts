import { json } from '@sveltejs/kit';
import { getPreset, insertPreset, listPresets } from '$lib/server/db';
import { emit } from '$lib/server/events';
import { presetFromBody } from '$lib/server/presets';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => json(listPresets());

export const POST: RequestHandler = async ({ request }) => {
	const id = insertPreset({ ...presetFromBody(await request.json()), source_file: null });
	emit({ type: 'presets.updated' });
	return json(getPreset(id!));
};
