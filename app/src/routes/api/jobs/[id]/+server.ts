import { error, json } from '@sveltejs/kit';
import { getJob } from '$lib/server/db';
import { deleteJob, updateJob } from '$lib/server/jobs';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params }) => {
	const job = getJob(params.id);
	if (!job) error(404, 'job not found');
	return json(job);
};

export const PATCH: RequestHandler = async ({ params, request }) =>
	json(updateJob(params.id, await request.json()));

export const DELETE: RequestHandler = async ({ params }) => {
	await deleteJob(params.id);
	return json({ ok: true });
};
