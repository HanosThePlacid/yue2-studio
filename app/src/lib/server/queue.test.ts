import { describe, expect, it } from 'vitest';
import { buildArgv, parseMetrics } from './queue';

const base = { lyrics: '[Verse]\nla', style: 'pop', cot: 'off' as const, cfg_scale: null, target_seconds: null, seed: 7 };

describe('buildArgv', () => {
	it('matches the legacy FastAPI argv', () => {
		const argv = buildArgv(base, '/out/x.wav');
		expect(argv.slice(0, 2)).toEqual(['--task', 'gen']);
		expect(argv).toContain('style=pop');
		expect(argv).toContain('cot=off');
		expect(argv.slice(-6)).toEqual(['--seed', '7', '--out', '/out/x.wav', '--metrics', '--log']);
		expect(argv.some((a) => a.startsWith('cfg_scale='))).toBe(false);
	});
	it('adds cfg_scale and token bounds from target_seconds', () => {
		const argv = buildArgv({ ...base, cfg_scale: 1.5, target_seconds: 60 }, '/o.wav');
		expect(argv).toContain('cfg_scale=1.5');
		expect(argv).toContain('semantic_min_tokens=1500');
		expect(argv).toContain('semantic_max_tokens=1500');
	});
});

describe('parseMetrics', () => {
	it('parses numeric and string metrics, ignores other lines', () => {
		const m = parseMetrics('loading...\nmetrics.rtf=3.2\nmetrics.audio_duration_source=output\nmetrics.wall_ms=1000\n');
		expect(m).toEqual({ rtf: 3.2, audio_duration_source: 'output', wall_ms: 1000 });
	});
});
