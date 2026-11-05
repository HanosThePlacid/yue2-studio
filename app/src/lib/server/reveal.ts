import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

const isWsl = () =>
	process.platform === 'linux' &&
	(!!process.env.WSL_DISTRO_NAME || /microsoft/i.test(fs.readFileSync('/proc/version', 'utf8')));

function wslInteropAvailable(): boolean {
	const dir = '/proc/sys/fs/binfmt_misc';
	if (!fs.existsSync(dir)) return false;
	return fs.readdirSync(dir).some((n) => n !== 'register' && n !== 'status');
}

function launch(cmd: string, argv: string[]) {
	const child = spawn(cmd, argv, { detached: true, stdio: 'ignore' });
	child.on('error', () => {});
	child.unref();
}

/** Open the OS file manager at `target` (selecting it when `select`). Throws a user-readable Error. */
export async function revealInExplorer(target: string, select: boolean) {
	if (process.platform === 'win32') {
		// explorer.exe returns non-zero even on success, so don't check the exit code.
		launch('explorer.exe', select ? [`/select,${target}`] : [target]);
		return;
	}
	if (process.platform === 'darwin') {
		launch('open', select ? ['-R', target] : [target]);
		return;
	}
	if (isWsl()) {
		if (!wslInteropAvailable()) {
			throw new Error(
				"WSL Windows-interop is not registered (no binfmt_misc entry), so explorer.exe can't be " +
					"launched. Fix from Windows: run 'wsl --shutdown' in PowerShell, then reopen your WSL terminal."
			);
		}
		const { stdout } = await run('wslpath', ['-w', target]);
		const winPath = stdout.trim();
		launch('explorer.exe', select ? [`/select,${winPath}`] : [winPath]);
		return;
	}
	// Plain Linux desktop: xdg-open can't select a file, so open its folder.
	launch('xdg-open', [select ? path.dirname(target) : target]);
}
