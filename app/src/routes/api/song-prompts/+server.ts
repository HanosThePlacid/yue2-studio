import { error, json } from '@sveltejs/kit';
import { listSongPromptFiles, readSongPromptFile } from '$lib/server/importer';
import type { RequestHandler } from './$types';

/** GET → list of md files; GET ?file=rel/path.md → parsed style + lyrics of that file. */
export const GET: RequestHandler = ({ url }) => {
	const file = url.searchParams.get('file');
	if (!file) return json(listSongPromptFiles());
	const parsed = readSongPromptFile(file);
	if (!parsed) error(404, 'no Style prompt block found in that file');
	return json(parsed);
};
