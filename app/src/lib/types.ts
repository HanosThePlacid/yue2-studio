export type JobStatus = 'queued' | 'running' | 'done' | 'error';
export type Cot = 'off' | 'melody' | 'full';

export interface Job {
	id: string;
	title: string;
	style: string;
	lyrics: string;
	cot: Cot;
	seed: number;
	cfg_scale: number | null;
	target_seconds: number | null;
	status: JobStatus;
	error_message: string | null;
	created_at: number;
	started_at: number | null;
	finished_at: number | null;
	example_id: string | null;
	preset_id: number | null;
	favorite: boolean;
	language: string;
	bpm: number | null;
	genre: string;
	duration_ms: number | null;
	wall_ms: number | null;
	rtf: number | null;
	metrics: Record<string, number | string>;
	audio_file: string;
	audio_url: string | null;
	categories: string[];
	flags: string[];
}

export interface Flag {
	id: number;
	name: string;
	color: string;
}

export interface Preset {
	id: number;
	name: string;
	style: string;
	bpm: number | null;
	genre: string;
	tags: string[];
	notes: string;
	default_lyrics: string;
	cot: Cot | null;
	target_seconds: number | null;
	source_file: string | null;
	created_at: number;
}

export interface GenerateInput {
	title?: string;
	style: string;
	lyrics: string;
	cot?: Cot;
	seed?: number | null;
	cfg_scale?: number | null;
	target_seconds?: number | null;
	categories?: string[];
	flags?: string[];
	example_id?: string | null;
	preset_id?: number | null;
}

export type ServerEvent =
	| { type: 'job.created'; job: Job }
	| { type: 'job.updated'; job: Job }
	| { type: 'job.deleted'; id: string }
	| { type: 'flags.updated' }
	| { type: 'presets.updated' };

export interface VersionInfo {
	/** Model name from the GGUF header, e.g. "Yue2-3B". */
	model: string;
	/** Quantization, e.g. "q4_0". */
	weights: string | null;
	gguf: string;
	/** First line of `audiocpp_cli --version`. */
	engine: string | null;
	commit: string | null;
	commit_date: string | null;
}
