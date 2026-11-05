import type { Flag, GenerateInput, Job, Preset, VersionInfo } from '$lib/types';

async function call<T>(url: string, init?: RequestInit & { body?: BodyInit | null }): Promise<T> {
	const res = await fetch(url, {
		...init,
		headers: init?.body ? { 'Content-Type': 'application/json', ...init.headers } : init?.headers
	});
	if (!res.ok) {
		let msg = `${res.status} ${res.statusText}`;
		try {
			msg = (await res.json()).message ?? msg;
		} catch {
			// non-JSON error body
		}
		throw new Error(msg);
	}
	return res.json() as Promise<T>;
}

const body = (v: unknown) => JSON.stringify(v);

export const api = {
	jobs: () => call<Job[]>('/api/jobs'),
	version: () => call<VersionInfo>('/api/version'),
	generate: (input: GenerateInput) => call<{ job: Job }>('/api/generate', { method: 'POST', body: body(input) }),
	updateJob: (id: string, patch: Partial<Pick<Job, 'title' | 'favorite' | 'categories' | 'flags' | 'language'>>) =>
		call<Job>(`/api/jobs/${id}`, { method: 'PATCH', body: body(patch) }),
	deleteJob: (id: string) => call<{ ok: true }>(`/api/jobs/${id}`, { method: 'DELETE' }),
	bulk: (ids: string[], action: string, value?: string) =>
		call<{ ok: true }>('/api/jobs/bulk', { method: 'POST', body: body({ ids, action, value }) }),
	reveal: (id: string) => call<{ ok: true }>(`/api/jobs/${id}/reveal`, { method: 'POST' }),
	openFolder: () => call<{ ok: true }>('/api/open-output-folder', { method: 'POST' }),
	flags: () => call<Flag[]>('/api/flags'),
	saveFlag: (name: string, color: string) => call<Flag>('/api/flags', { method: 'POST', body: body({ name, color }) }),
	deleteFlag: (id: number) => call<{ ok: true }>(`/api/flags/${id}`, { method: 'DELETE' }),
	presets: () => call<Preset[]>('/api/presets'),
	createPreset: (p: Partial<Preset>) => call<Preset>('/api/presets', { method: 'POST', body: body(p) }),
	updatePreset: (id: number, p: Partial<Preset>) =>
		call<Preset>(`/api/presets/${id}`, { method: 'PUT', body: body(p) }),
	deletePreset: (id: number) => call<{ ok: true }>(`/api/presets/${id}`, { method: 'DELETE' }),
	songPromptFiles: () => call<string[]>('/api/song-prompts'),
	songPromptFile: (file: string) =>
		call<Omit<Preset, 'id' | 'created_at'>>(`/api/song-prompts?file=${encodeURIComponent(file)}`)
};
