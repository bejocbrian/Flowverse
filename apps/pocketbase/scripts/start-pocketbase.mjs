/**
 * Local dev launcher for PocketBase.
 *
 * - Reads apps/pocketbase/.env and injects all variables into the child process environment
 * - Resolves the pocketbase binary via PATH (pocketbase.cmd wrapper) the same way npm does
 * - Passes all CLI arguments through unchanged
 * - Works on Windows (cmd/powershell) because it uses Node's spawn, not a shell built-in
 *
 * Usage (via package.json script):
 *   node scripts/start-pocketbase.mjs serve --http=0.0.0.0:8090 ...
 */

import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, '..');

// ---------- load .env ----------
const envFile = resolve(appRoot, '.env');
const extraEnv = {};

if (existsSync(envFile)) {
  const lines = readFileSync(envFile, 'utf8').split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    extraEnv[key] = val;
  }
}

// ---------- resolve binary ----------
// On Windows npm adds node_modules/.bin to PATH and pocketbase.cmd lives there.
// We just invoke "pocketbase" and let the shell resolve it via PATH.
const isWindows = process.platform === 'win32';
const binary = isWindows ? 'pocketbase.cmd' : 'pocketbase';

// CLI args forwarded from package.json script
const args = process.argv.slice(2);

// Pass --encryptionEnv only if PB_ENCRYPTION_KEY is set
if (extraEnv.PB_ENCRYPTION_KEY && !args.includes('--encryptionEnv=PB_ENCRYPTION_KEY')) {
  args.push('--encryptionEnv=PB_ENCRYPTION_KEY');
}

console.log(`[pocketbase] starting: ${binary} ${args.join(' ')}`);

const child = spawn(binary, args, {
  cwd: appRoot,              // always run from apps/pocketbase/
  stdio: 'inherit',
  shell: true,               // needed on Windows to resolve .cmd wrappers
  env: {
    ...process.env,
    ...extraEnv,             // .env values win over inherited env
  },
});

child.on('error', (err) => {
  console.error(`[pocketbase] failed to start: ${err.message}`);
  console.error(
    'Make sure pocketbase.exe is accessible via PATH or the pocketbase.cmd wrapper is correct.'
  );
  process.exit(1);
});

child.on('close', (code) => {
  process.exit(code ?? 0);
});
