import fs from 'node:fs';
import path from 'node:path';

const env = process.env;
const isWindows = process.platform === 'win32';

// Repo root = parent of app/. Both `npm run dev` and `npm start` run with cwd = app/.
function repoRoot(): string {
	if (env.YUE2_ROOT) return env.YUE2_ROOT;
	const cwd = process.cwd();
	return path.basename(cwd) === 'app' ? path.dirname(cwd) : cwd;
}

export const ROOT_DIR = repoRoot();

// `<root>/.env` (written by the install scripts) fills in anything not already set in the real
// environment. Real env vars always win.
const envFile = path.join(ROOT_DIR, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

export const OUTPUT_DIR = path.join(ROOT_DIR, 'output');
export const SONG_PROMPTS_DIR = path.join(ROOT_DIR, 'song-prompts');
export const DB_PATH = env.YUE2_DB ?? path.join(ROOT_DIR, 'data', 'studio.db');

export const AUDIOCPP_CLI =
	env.AUDIOCPP_CLI ?? path.join(ROOT_DIR, 'engine', 'bin', isWindows ? 'audiocpp_cli.exe' : 'audiocpp_cli');
export const MODEL_DIR = env.YUE2_MODEL_DIR ?? path.join(ROOT_DIR, 'models', 'Yue2-3B-GGUF');
export const MODEL_GGUF = env.YUE2_MODEL_GGUF ?? 'yue2-3b-q4_0.gguf';
/** audio.cpp backend: cuda, vulkan, cpu, ... Must match how the engine binary was built. */
export const BACKEND = env.YUE2_BACKEND ?? 'cuda';
/** Extra shared-library dir for the CUDA runtime (Linux). Empty = rely on the system loader. */
export const CUDA_LIB = env.CUDA_LIB ?? '';

/** Environment for spawning the engine, with CUDA_LIB prepended to the library search path. */
export function engineEnv(): NodeJS.ProcessEnv {
	if (!CUDA_LIB) return { ...process.env };
	if (isWindows) return { ...process.env, PATH: `${CUDA_LIB};${process.env.PATH ?? ''}` };
	return { ...process.env, LD_LIBRARY_PATH: `${CUDA_LIB}:${process.env.LD_LIBRARY_PATH ?? ''}` };
}

export const SECONDS_PER_TOKEN = 0.04; // rough calibration from observed generations, not exact
