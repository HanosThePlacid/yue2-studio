import { json } from '@sveltejs/kit';
import { createJob } from '$lib/server/jobs';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const job = createJob(await request.json());
	return json({ job_id: job.id, job });
};
