import { describe, expect, it } from 'vitest';
import { parseEngineVersion, readGgufStrings } from './version';

function gguf(kvs: [string, number, Buffer][]): Buffer {
	const u32 = (n: number) => Buffer.from(new Uint32Array([n]).buffer);
	const u64 = (n: number) => Buffer.from(new BigUint64Array([BigInt(n)]).buffer);
	const str = (s: string) => Buffer.concat([u64(Buffer.byteLength(s)), Buffer.from(s)]);
	return Buffer.concat([
		Buffer.from('GGUF'), u32(3), u64(0), u64(kvs.length),
		...kvs.flatMap(([k, t, v]) => [str(k), u32(t), v])
	]);
}

describe('readGgufStrings', () => {
	it('finds string keys past arrays and scalars', () => {
		const str = (s: string) => Buffer.concat([Buffer.from(new BigUint64Array([BigInt(s.length)]).buffer), Buffer.from(s)]);
		const arr = Buffer.concat([Buffer.from(new Uint32Array([8]).buffer), Buffer.from(new BigUint64Array([2n]).buffer), str('a'), str('bc')]);
		const buf = gguf([
			['general.architecture', 8, str('audiocpp')],
			['some.array', 9, arr],
			['some.u32', 4, Buffer.alloc(4)],
			['general.name', 8, str('Yue2-3B-GGUF')],
			['audiocpp.weight_type', 8, str('q4_0')]
		]);
		expect(readGgufStrings(buf, ['general.name', 'audiocpp.weight_type'])).toEqual({
			'general.name': 'Yue2-3B-GGUF',
			'audiocpp.weight_type': 'q4_0'
		});
	});

	it('returns nothing for non-GGUF data', () => {
		expect(readGgufStrings(Buffer.from('nope'), ['general.name'])).toEqual({});
	});
});

describe('parseEngineVersion', () => {
	it('parses audiocpp_cli --version output', () => {
		const out = 'audio.cpp dev\ngit: 4611f3d 2026-09-14\nbuild: RelWithDebInfo\n';
		expect(parseEngineVersion(out)).toEqual({ engine: 'audio.cpp dev', commit: '4611f3d', commit_date: '2026-09-14' });
	});
});
