// Dev launcher: pick a free port starting at 5173 and make BOTH Vite and Tauri
// use it. Avoids the "white screen" caused by Vite silently falling back to
// 5174 while Tauri keeps loading the hardcoded 5173.
import net from 'node:net';
import { spawn } from 'node:child_process';

const BASE_PORT = 5173;
const MAX_TRIES = 20;

function isFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port, '127.0.0.1');
  });
}

async function findPort() {
  for (let p = BASE_PORT; p < BASE_PORT + MAX_TRIES; p++) {
    if (await isFree(p)) return p;
  }
  throw new Error(`No free port found in ${BASE_PORT}..${BASE_PORT + MAX_TRIES}`);
}

const port = await findPort();
if (port !== BASE_PORT) {
  console.log(`[dev] Port ${BASE_PORT} belegt — verwende stattdessen ${port}`);
} else {
  console.log(`[dev] Verwende Port ${port}`);
}

// Override both devUrl and beforeDevCommand so Tauri starts Vite on the chosen
// port (strictPort => fail loudly instead of drifting to yet another port).
const configOverride = JSON.stringify({
  build: {
    devUrl: `http://localhost:${port}`,
    beforeDevCommand: `vite --port ${port} --strictPort`,
  },
});

const child = spawn(
  'npx',
  ['tauri', 'dev', '--config', configOverride],
  { stdio: 'inherit', shell: true }
);

child.on('exit', (code) => process.exit(code ?? 0));
