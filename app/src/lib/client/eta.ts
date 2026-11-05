import type { Job } from '$lib/types';

/**
 * Estimated total generation time (seconds) for a job, from finished jobs with the same planning
 * mode and a similar audio length. Speed isn't linear in length (long songs have a higher rtf,
 * short ones pay a fixed model-load cost), so nearest neighbours beat a global average.
 * Returns null when there is no comparable history.
 */
export function estimateWallSeconds(job: Job, history: Job[], k = 3): number | null {
	const finished = history.filter((j) => j.status === 'done' && j.wall_ms && j.duration_ms && j.id !== job.id);
	const sameCot = finished.filter((j) => j.cot === job.cot);
	const pool = sameCot.length ? sameCot : finished;
	if (!pool.length) return null;

	let expected = job.target_seconds;
	if (!expected) {
		const durations = pool.map((j) => j.duration_ms! / 1000).sort((a, b) => a - b);
		expected = durations[Math.floor(durations.length / 2)];
	}

	const nearest = [...pool]
		.sort((a, b) => Math.abs(a.duration_ms! / 1000 - expected!) - Math.abs(b.duration_ms! / 1000 - expected!))
		.slice(0, k);
	const rtf = nearest.reduce((s, j) => s + j.wall_ms! / j.duration_ms!, 0) / nearest.length;
	return expected * rtf;
}
