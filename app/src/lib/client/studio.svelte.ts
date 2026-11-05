import { api } from './api';
import type { Flag, GenerateInput, Job, Preset, ServerEvent, VersionInfo } from '$lib/types';

export interface Toast {
	id: number;
	text: string;
	kind: 'info' | 'error';
}

/** Global live state: all jobs/flags/presets, kept current over SSE. One instance per tab. */
class Studio {
	jobs = $state<Job[]>([]);
	flags = $state<Flag[]>([]);
	presets = $state<Preset[]>([]);
	version = $state<VersionInfo | null>(null);
	loaded = $state(false);
	connected = $state(false);
	nowPlaying = $state<Job | null>(null);
	/** Set by "Reuse"/"Use preset" elsewhere; the Generate composer consumes it on mount. */
	draft = $state<Partial<GenerateInput> | null>(null);
	toasts = $state<Toast[]>([]);

	#source: EventSource | null = null;
	#toastSeq = 0;

	active = $derived(this.jobs.filter((j) => j.status === 'running' || j.status === 'queued'));
	categories = $derived(
		[...new Set(this.jobs.flatMap((j) => j.categories))].sort((a, b) => a.localeCompare(b))
	);
	flagColor = $derived(new Map(this.flags.map((f) => [f.name.toLowerCase(), f.color])));

	async start() {
		if (this.#source) return;
		this.#connect();
		api.version().then((v) => (this.version = v), () => {});
		await this.reload();
	}

	async reload() {
		const [jobs, flags, presets] = await Promise.all([api.jobs(), api.flags(), api.presets()]);
		this.jobs = jobs;
		this.flags = flags;
		this.presets = presets;
		this.loaded = true;
	}

	#connect() {
		const es = new EventSource('/api/events');
		this.#source = es;
		es.onopen = () => {
			// After a reconnect we may have missed events; resync once.
			if (this.loaded && !this.connected) void this.reload();
			this.connected = true;
		};
		es.onerror = () => (this.connected = false);
		es.onmessage = (m) => this.#apply(JSON.parse(m.data) as ServerEvent);
	}

	#apply(e: ServerEvent) {
		switch (e.type) {
			case 'job.created':
			case 'job.updated': {
				const i = this.jobs.findIndex((j) => j.id === e.job.id);
				if (i >= 0) this.jobs[i] = e.job;
				else this.jobs = [e.job, ...this.jobs];
				if (this.nowPlaying?.id === e.job.id) this.nowPlaying = e.job;
				break;
			}
			case 'job.deleted':
				this.jobs = this.jobs.filter((j) => j.id !== e.id);
				if (this.nowPlaying?.id === e.id) this.nowPlaying = null;
				break;
			case 'flags.updated':
				void api.flags().then((f) => (this.flags = f));
				break;
			case 'presets.updated':
				void api.presets().then((p) => (this.presets = p));
				break;
		}
	}

	toast(text: string, kind: Toast['kind'] = 'info') {
		const id = ++this.#toastSeq;
		this.toasts = [...this.toasts, { id, text, kind }];
		setTimeout(() => (this.toasts = this.toasts.filter((t) => t.id !== id)), kind === 'error' ? 8000 : 3500);
	}

	/** Run an API call, surfacing failures as a toast instead of throwing. */
	async attempt<T>(fn: () => Promise<T>, ok?: string): Promise<T | undefined> {
		try {
			const r = await fn();
			if (ok) this.toast(ok);
			return r;
		} catch (err) {
			this.toast((err as Error).message, 'error');
			return undefined;
		}
	}

	play(job: Job) {
		this.nowPlaying = job;
	}
}

export const studio = new Studio();
