import { error, json } from '@sveltejs/kit';
import { getJob } from '$lib/server/db';
import { deleteJob, updateJob } from '$lib/server/jobs';
import type { RequestHandler } from './$types';

interface BulkRequest {
	ids: string[];
	action: 'delete' | 'favorite' | 'unfavorite' | 'add-category' | 'remove-category' | 'add-flag' | 'remove-flag';
	value?: string;
}

export const POST: RequestHandler = async ({ request }) => {
	const { ids, action, value } = (await request.json()) as BulkRequest;
	if (!Array.isArray(ids) || !ids.length) error(400, 'ids required');
	const needsValue = action.includes('category') || action.includes('flag');
	if (needsValue && !value?.trim()) error(400, 'value required');
	const v = value?.trim() ?? '';
	for (const id of ids) {
		const job = getJob(id);
		if (!job) continue;
		switch (action) {
			case 'delete':
				await deleteJob(id);
				break;
			case 'favorite':
			case 'unfavorite':
				updateJob(id, { favorite: action === 'favorite' });
				break;
			case 'add-category':
				updateJob(id, { categories: [...job.categories, v] });
				break;
			case 'remove-category':
				updateJob(id, { categories: job.categories.filter((c) => c.toLowerCase() !== v.toLowerCase()) });
				break;
			case 'add-flag':
				updateJob(id, { flags: [...job.flags, v] });
				break;
			case 'remove-flag':
				updateJob(id, { flags: job.flags.filter((f) => f.toLowerCase() !== v.toLowerCase()) });
				break;
			default:
				error(400, `unknown action ${action}`);
		}
	}
	return json({ ok: true });
};
