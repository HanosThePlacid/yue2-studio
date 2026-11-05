import { subscribe } from '$lib/server/events';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ request }) => {
	let unsubscribe = () => {};
	let heartbeat: ReturnType<typeof setInterval>;
	const stream = new ReadableStream({
		start(controller) {
			const enc = new TextEncoder();
			const send = (chunk: string) => controller.enqueue(enc.encode(chunk));
			send(': connected\n\n');
			unsubscribe = subscribe((e) => send(`data: ${JSON.stringify(e)}\n\n`));
			heartbeat = setInterval(() => send(': ping\n\n'), 25_000);
			request.signal.addEventListener('abort', () => {
				clearInterval(heartbeat);
				unsubscribe();
				try {
					controller.close();
				} catch {
					// already closed
				}
			});
		},
		cancel() {
			clearInterval(heartbeat);
			unsubscribe();
		}
	});
	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
