import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

import config from './config.js';
import { initDb, closeDb } from './db/index.js';
import { registerRoutes } from './routes/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const NO_OPEN = args.includes('--no-open') || process.env.CI === '1';
const VERBOSE = args.includes('--verbose');

function log(...parts) {
  if (VERBOSE) console.log('[coursestream]', ...parts);
}

/** Try to listen, incrementing the port if it is taken. */
function listenOnAvailablePort(app, port, attemptsLeft) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, config.HOST);
    server.once('listening', () => resolve(server));
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE' && attemptsLeft > 1) {
        server.close();
        log(`port ${port} in use, trying ${port + 1}`);
        resolve(listenOnAvailablePort(app, port + 1, attemptsLeft - 1));
        return;
      }
      reject(err);
    });
  });
}

/** Open the default browser on the given URL. */
function openBrowser(url) {
  const cmd =
    process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const cmdArgs = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    const child = spawn(cmd, cmdArgs, { stdio: 'ignore', detached: true, shell: false });
    child.on('error', () => {
      console.log(`Open manually: ${url}`);
    });
    child.unref();
  } catch {
    console.log(`Open manually: ${url}`);
  }
}

async function main() {
  await initDb();

  const app = express();
  app.set('x-powered-by', false);

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Hashed build assets — safe to cache forever.
  app.use('/assets', express.static(path.join(config.DIST_DIR, 'assets'), { immutable: true, maxAge: '1y' }));
  // The stylesheet is served from public/css (not hashed).
  app.use('/css', express.static(path.join(config.PUBLIC_DIR, 'css'), { maxAge: '1h' }));

  registerRoutes(app);

  const server = await listenOnAvailablePort(app, config.DEFAULT_PORT, config.MAX_PORT_ATTEMPTS);
  const { port } = server.address();
  const url = `http://${config.HOST}:${port}`;

  console.log(`\n  CourseStream running at ${url}`);
  console.log(`  Data directory: ${config.appDataDir()}`);
  console.log(`  Press Ctrl+C to stop.\n`);

  if (!NO_OPEN) openBrowser(url);

  const shutdown = (signal) => {
    console.log(`\nReceived ${signal}, shutting down...`);
    server.close(() => {
      closeDb();
      process.exit(0);
    });
    // Force-exit if connections linger.
    setTimeout(() => {
      closeDb();
      process.exit(0);
    }, 3000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Failed to start CourseStream:', err);
  process.exit(1);
});
