import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { AUDIOCPP_CLI, engineEnv, MODEL_DIR, MODEL_GGUF } from './config';
import type { VersionInfo } from '$lib/types';

// GGUF value type -> byte size for fixed-width scalars (8 = string, 9 = array).
const SCALAR_SIZE: Record<number, number> = { 0: 1, 1: 1, 2: 2, 3: 2, 4: 4, 5: 4, 6: 4, 7: 1, 10: 8, 11: 8, 12: 8 };

/** Reads string metadata keys from a GGUF header. Stops once all wanted keys are found. */
export function readGgufStrings(buf: Buffer, wanted: string[]): Record<string, string> {
	const found: Record<string, string> = {};
	if (buf.toString('latin1', 0, 4) !== 'GGUF') return found;
	let pos = 4 + 4 + 8; // magic, version, tensor count
	const kvCount = Number(buf.readBigUInt64LE(pos));
	pos += 8;
	const str = () => {
		const n = Number(buf.readBigUInt64LE(pos));
		const s = buf.toString('utf8', pos + 8, pos + 8 + n);
		pos += 8 + n;
		return s;
	};
	const skip = (type: number) => {
		if (type === 8) return void str();
		if (type === 9) {
			const elem = buf.readUInt32LE(pos);
			const n = Number(buf.readBigUInt64LE(pos + 4));
			pos += 12;
			for (let i = 0; i < n; i++) skip(elem);
			return;
		}
		const size = SCALAR_SIZE[type];
		if (size === undefined) throw new Error(`unknown GGUF type ${type}`);
		pos += size;
	};
	try {
		for (let i = 0; i < kvCount && Object.keys(found).length < wanted.length; i++) {
			const key = str();
			const type = buf.readUInt32LE(pos);
			pos += 4;
			if (type === 8 && wanted.includes(key)) found[key] = str();
			else skip(type);
		}
	} catch {
		// header ran past the bytes we read; return what we have
	}
	return found;
}

function modelInfo(): Pick<VersionInfo, 'model' | 'weights'> {
	const file = path.join(MODEL_DIR, MODEL_GGUF);
	try {
		const fd = fs.openSync(file, 'r');
		const buf = Buffer.alloc(1 << 20);
		const len = fs.readSync(fd, buf, 0, buf.length, 0);
		fs.closeSync(fd);
		const meta = readGgufStrings(buf.subarray(0, len), ['general.name', 'audiocpp.weight_type']);
		return {
			model: (meta['general.name'] ?? path.basename(MODEL_DIR)).replace(/-GGUF$/i, ''),
			weights: meta['audiocpp.weight_type'] ?? null
		};
	} catch {
		return { model: path.basename(MODEL_DIR), weights: null };
	}
}

/** Parses `audiocpp_cli --version`, e.g. "git: 4611f3d 2026-09-14". */
export function parseEngineVersion(text: string): Pick<VersionInfo, 'engine' | 'commit' | 'commit_date'> {
	const git = text.match(/^git:\s*(\S+)\s+(\S+)/m);
	return {
		engine: text.split(/\r?\n/)[0]?.trim() || null,
		commit: git?.[1] ?? null,
		commit_date: git?.[2] ?? null
	};
}

function engineInfo() {
	try {
		const out = execFileSync(AUDIOCPP_CLI, ['--version'], { env: engineEnv(), timeout: 10_000, windowsHide: true });
		return parseEngineVersion(out.toString());
	} catch {
		return { engine: null, commit: null, commit_date: null };
	}
}

let cached: VersionInfo | null = null;

export function versionInfo(): VersionInfo {
	cached ??= { ...modelInfo(), gguf: MODEL_GGUF, ...engineInfo() };
	return cached;
}
