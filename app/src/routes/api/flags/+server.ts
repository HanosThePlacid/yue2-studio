import { error, json } from '@sveltejs/kit';
import { listFlags, upsertFlag } from '$lib/server/db';
import { emit } from '$lib/server/events';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => json(listFlags());

export const POST: RequestHandler = async ({ request }) => {
	const { name, color } = await request.json();
	if (!name?.trim()) error(400, 'name required');
	const flag = upsertFlag(name, color || '#a855f7');
	emit({ type: 'flags.updated' });
	return json(flag);
};
