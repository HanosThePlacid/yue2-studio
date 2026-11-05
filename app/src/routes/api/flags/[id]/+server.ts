import { json } from '@sveltejs/kit';
import { deleteFlag, getJob, writeSidecar } from '$lib/server/db';
import { emit } from '$lib/server/events';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = ({ params }) => {
	for (const id of deleteFlag(Number(params.id))) {
		const job = getJob(id);
		if (!job) continue;
		writeSidecar(job);
		emit({ type: 'job.updated', job });
	}
	emit({ type: 'flags.updated' });
	return json({ ok: true });
};
