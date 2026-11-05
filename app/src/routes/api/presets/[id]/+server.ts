import { error, json } from '@sveltejs/kit';
import { deletePreset, getPreset, updatePreset } from '$lib/server/db';
import { emit } from '$lib/server/events';
import { presetFromBody } from '$lib/server/presets';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ params, request }) => {
	const id = Number(params.id);
	const existing = getPreset(id);
	if (!existing) error(404, 'preset not found');
	updatePreset(id, { ...presetFromBody(await request.json()), source_file: existing.source_file });
	emit({ type: 'presets.updated' });
	return json(getPreset(id));
};

export const DELETE: RequestHandler = ({ params }) => {
	deletePreset(Number(params.id));
	emit({ type: 'presets.updated' });
	return json({ ok: true });
};
