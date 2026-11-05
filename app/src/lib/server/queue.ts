import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
	AUDIOCPP_CLI,
	BACKEND,
	engineEnv,
	MODEL_DIR,
	MODEL_GGUF,
	OUTPUT_DIR,
	SECONDS_PER_TOKEN
} from './config';
import { getJob, jobIdsWithStatus, patchJob, writeSidecar } from './db';
import { emit } from './events';
import type { Job } from '$lib/types';

export function buildArgv(job: Pick<Job, 'lyrics' | 'style' | 'cot' | 'cfg_scale' | 'target_seconds' | 'seed'>, wavPath: string): string[] {
	const argv = [
		'--task', 'gen',
		'--family', 'yue2',
		'--model', MODEL_DIR,
		'--backend', BACKEND,
		'--session-option', `yue2.model_gguf=${MODEL_GGUF}`,
		'--lyrics', job.lyrics,
		'--request-option', `style=${job.style}`,
		'--request-option', `cot=${job.cot}`
	];
	if (job.cfg_scale !== null) argv.push('--request-option', `cfg_scale=${job.cfg_scale}`);
	if (job.target_seconds !== null) {
		const tokens = Math.max(1, Math.round(job.target_seconds / SECONDS_PER_TOKEN));
		argv.push(
			'--request-option', `semantic_min_tokens=${tokens}`,
			'--request-option', `semantic_max_tokens=${tokens}`
		);
	}
	argv.push('--seed', String(job.seed), '--out', wavPath, '--metrics', '--log');
	return argv;
}

export function parseMetrics(stdout: string): Record<string, number | string> {
	const metrics: Record<string, number | string> = {};
	for (const line of stdout.split(/\r?\n/)) {
		if (!line.startsWith('metrics.')) continue;
		const eq = line.indexOf('=');
		if (eq < 0) continue;
		const key = line.slice('metrics.'.length, eq);
		const val = line.slice(eq + 1);
		const n = Number(val);
		metrics[key] = val.trim() !== '' && Number.isFinite(n) ? n : val;
	}
	return metrics;
}

function publish(id: string) {
	const job = getJob(id);
	if (!job) return;
	writeSidecar(job);
	emit({ type: 'job.updated', job });
}

function runJob(job: Job): Promise<void> {
	const wavPath = path.join(OUTPUT_DIR, job.audio_file);
	patchJob(job.id, { status: 'running', started_at: Date.now() / 1000 });
	publish(job.id);

	return new Promise((resolve) => {
		const env = engineEnv();
		let out = '';
		const finish = (ok: boolean, err?: string) => {
			const metrics = parseMetrics(out);
			const num = (k: string) => (typeof metrics[k] === 'number' ? (metrics[k] as number) : null);
			patchJob(job.id, ok
				? {
						status: 'done',
						finished_at: Date.now() / 1000,
						metrics,
						duration_ms: num('audio_duration_ms'),
						wall_ms: num('wall_ms'),
						rtf: num('rtf'),
						error_message: null
					}
				: { status: 'error', finished_at: Date.now() / 1000, error_message: err ?? out.slice(-2000) });
			publish(job.id);
			resolve();
		};
		let proc: ChildProcess;
		try {
			// Own process group (POSIX), so an abort can kill the generator together with any children
			// it spawned. On Windows `detached` would open a new console window, so skip it there.
			proc = spawn(AUDIOCPP_CLI, buildArgv(job, wavPath), {
				env,
				detached: process.platform !== 'win32',
				windowsHide: true
			});
		} catch (e) {
			finish(false, String(e));
			return;
		}
		state.current = { id: job.id, proc };
		proc.stdout!.on('data', (b: Buffer) => (out += b.toString()));
		proc.stderr!.on('data', (b: Buffer) => (out += b.toString()));
		proc.on('error', (e) => finish(false, String(e)));
		proc.on('close', (code) => {
			if (state.current?.id === job.id) state.current = null;
			finish(code === 0 && fs.existsSync(wavPath));
		});
	});
}

// Single GPU → one job at a time. State kept on globalThis so dev HMR doesn't start a 2nd worker.
interface QueueState {
	pending: string[];
	busy: boolean;
	current: { id: string; proc: ChildProcess } | null;
}
const g = globalThis as unknown as { __yue2Queue?: QueueState };
const state = (g.__yue2Queue ??= { pending: [], busy: false, current: null });
state.current ??= null;

async function drain() {
	if (state.busy) return;
	state.busy = true;
	try {
		while (state.pending.length) {
			const id = state.pending.shift()!;
			const job = getJob(id);
			if (!job || job.status !== 'queued') continue;
			try {
				await runJob(job);
			} catch (e) {
				patchJob(id, { status: 'error', error_message: String(e) });
				publish(id);
			}
		}
	} finally {
		state.busy = false;
	}
}

export function enqueue(id: string) {
	if (!state.pending.includes(id)) state.pending.push(id);
	void drain();
}

export function removeFromQueue(id: string) {
	state.pending = state.pending.filter((p) => p !== id);
}

/** PIDs of audiocpp_cli processes writing to `wavPath` (found via /proc, Linux only). */
function findGeneratorPids(wavPath: string): number[] {
	const pids: number[] = [];
	if (process.platform !== 'linux') return pids;
	for (const entry of fs.readdirSync('/proc')) {
		if (!/^\d+$/.test(entry)) continue;
		try {
			const argv = fs.readFileSync(`/proc/${entry}/cmdline`, 'utf8').split('\0');
			const out = argv.indexOf('--out');
			if (argv[0] === AUDIOCPP_CLI && out >= 0 && argv[out + 1] === wavPath) pids.push(Number(entry));
		} catch {
			// process exited while scanning
		}
	}
	return pids;
}

const alive = (pid: number) => {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
};

/**
 * Kill the generator process for a job. Resolves once it has exited (SIGTERM, then SIGKILL after
 * 5 s), so the caller can safely delete its output files. Falls back to a /proc scan when the
 * process isn't the one this worker tracks (e.g. spawned before a dev-server reload).
 */
export async function cancelRunning(id: string, audioFile: string): Promise<void> {
	const cur = state.current;
	if (cur?.id === id && cur.proc.exitCode === null && cur.proc.signalCode === null) {
		const { proc } = cur;
		const killGroup = (sig: NodeJS.Signals) => {
			try {
				process.kill(-proc.pid!, sig);
			} catch {
				proc.kill(sig);
			}
		};
		await new Promise<void>((resolve) => {
			const force = setTimeout(() => killGroup('SIGKILL'), 5000);
			proc.once('exit', () => {
				clearTimeout(force);
				resolve();
			});
			killGroup('SIGTERM');
		});
		return;
	}
	const pids = findGeneratorPids(path.join(OUTPUT_DIR, audioFile));
	for (const pid of pids) process.kill(pid, 'SIGTERM');
	for (let waited = 0; pids.some(alive) && waited < 5000; waited += 100) {
		await new Promise((r) => setTimeout(r, 100));
	}
	for (const pid of pids.filter(alive)) process.kill(pid, 'SIGKILL');
}

/** On startup: anything left `running` was killed with the server; re-run it and all `queued`. */
export function resumeQueue() {
	for (const id of jobIdsWithStatus(['running'])) patchJob(id, { status: 'queued' });
	for (const id of jobIdsWithStatus(['queued'])) enqueue(id);
}
