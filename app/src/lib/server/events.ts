import type { ServerEvent } from '$lib/types';

type Listener = (e: ServerEvent) => void;

// Survive Vite HMR reloads of this module in dev, so open SSE streams keep receiving.
const g = globalThis as unknown as { __yue2Listeners?: Set<Listener> };
const listeners = (g.__yue2Listeners ??= new Set<Listener>());

export function subscribe(fn: Listener): () => void {
	listeners.add(fn);
	return () => listeners.delete(fn);
}

export function emit(e: ServerEvent) {
	for (const fn of listeners) {
		try {
			fn(e);
		} catch {
			// a broken stream must not stop the others
		}
	}
}
