import { describe, expect, it } from 'vitest';
import { estimateWallSeconds } from './eta';
import type { Job } from '$lib/types';

const job = (p: Partial<Job>): Job =>
	({ id: Math.random().toString(), status: 'done', cot: 'off', target_seconds: null, wall_ms: null, duration_ms: null, ...p }) as Job;

const history = [
	job({ cot: 'off', duration_ms: 60_000, wall_ms: 93_000 }),
	job({ cot: 'off', duration_ms: 60_000, wall_ms: 92_000 }),
	job({ cot: 'off', duration_ms: 242_000, wall_ms: 751_000 }),
	job({ cot: 'melody', duration_ms: 60_000, wall_ms: 131_000 }),
	job({ cot: 'melody', duration_ms: 241_000, wall_ms: 775_000 })
];

describe('estimateWallSeconds', () => {
	it('uses same-cot neighbours of similar length', () => {
		const e = estimateWallSeconds(job({ status: 'running', cot: 'off', target_seconds: 60 }), history, 2)!;
		expect(e).toBeCloseTo(92.5, 0);
	});
	it('long songs get the slower long-song rate', () => {
		const e = estimateWallSeconds(job({ status: 'running', cot: 'melody', target_seconds: 240 }), history, 1)!;
		expect(e).toBeGreaterThan(700);
	});
	it('returns null without history', () => {
		expect(estimateWallSeconds(job({ status: 'running' }), [])).toBeNull();
	});
});
