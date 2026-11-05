import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { error } from '@sveltejs/kit';
import { OUTPUT_DIR } from '$lib/server/config';
import type { RequestHandler } from './$types';

// Streams a WAV from output/ with HTTP Range support, so the <audio> element can seek.
export const GET: RequestHandler = ({ params, request, url }) => {
	const full = path.resolve(OUTPUT_DIR, params.file);
	if (path.dirname(full) !== path.resolve(OUTPUT_DIR) || !full.endsWith('.wav')) error(400, 'bad file');
	if (!fs.existsSync(full)) error(404, 'not found');
	const size = fs.statSync(full).size;
	const headers: Record<string, string> = {
		'Content-Type': 'audio/wav',
		'Accept-Ranges': 'bytes',
		'Cache-Control': 'no-cache'
	};
	if (url.searchParams.has('download')) {
		headers['Content-Disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(params.file)}`;
	}
	const range = request.headers.get('range')?.match(/bytes=(\d*)-(\d*)/);
	if (range) {
		const start = range[1] ? Number(range[1]) : size - Number(range[2]);
		const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
		if (start >= size || start > end) {
			return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
		}
		const body = Readable.toWeb(fs.createReadStream(full, { start, end })) as ReadableStream;
		return new Response(body, {
			status: 206,
			headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) }
		});
	}
	const body = Readable.toWeb(fs.createReadStream(full)) as ReadableStream;
	return new Response(body, { headers: { ...headers, 'Content-Length': String(size) } });
};
