// Cross-platform production launcher: `npm start` (after `npm run build`).
// Loads ../.env (written by the installer) so PORT/HOST apply, defaults PORT to 8000.
import fs from 'node:fs';
import path from 'node:path';

const envFile = path.resolve('..', '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
process.env.PORT ??= '8000';
process.env.HOST ??= '127.0.0.1';
console.log(`[yue2] http://localhost:${process.env.PORT}`);
await import('./build/index.js');
