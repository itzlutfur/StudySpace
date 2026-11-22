import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(__dirname, '..');

/**
 * The product name shown in the UI.
 *
 * Note: `APP_NAME` also names the data directory under %APPDATA%. It is
 * deliberately NOT the display name — renaming it would orphan every existing
 * user's database. The two are separated here so that is explicit.
 */
export const APP_NAME = 'CourseStream';
export const DISPLAY_NAME = 'StudySpace';

export const DEFAULT_PORT = 4317;
export const MAX_PORT_ATTEMPTS = 11; // 4317..4327

export const HOST = '127.0.0.1';

export const DB_FILENAME = 'courses.db';
export const SETTINGS_FILENAME = 'library.json';

/** Resolve the per-user application data directory (no files in the project folder). */
export function appDataDir() {
  if (process.env.COURSESTREAM_DATA_DIR) {
    return path.resolve(process.env.COURSESTREAM_DATA_DIR);
  }
  const home = os.homedir();
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    return path.join(appData, APP_NAME);
  }
  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', APP_NAME);
  }
  return path.join(process.env.XDG_DATA_HOME || path.join(home, '.local', 'share'), 'coursestream');
}

/** Scanner limits — protects against pathological folders. */
export const SCAN = {
  maxDepth: 4,
  maxFiles: 5000,
  ignoredNames: new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']),
  ignoredExtensions: new Set(['.tmp', '.part', '.crdownload', '.download']),
};

export const COMPLETION_THRESHOLD = 0.9; // 90% watched => lesson complete
export const RESUME_MIN_SECONDS = 5;      // don't offer resume below this
export const RESUME_MAX_PCT = 0.95;       // don't offer resume at/above this

export const VIEWS_DIR = path.join(ROOT, 'src', 'views');
export const PUBLIC_DIR = path.join(ROOT, 'public');
/** Built React bundle, emitted by `vite build` into public/dist. */
export const DIST_DIR = path.join(PUBLIC_DIR, 'dist');

export default {
  ROOT,
  APP_NAME,
  DEFAULT_PORT,
  MAX_PORT_ATTEMPTS,
  HOST,
  DB_FILENAME,
  SETTINGS_FILENAME,
  appDataDir,
  SCAN,
  COMPLETION_THRESHOLD,
  RESUME_MIN_SECONDS,
  RESUME_MAX_PCT,
  VIEWS_DIR,
  PUBLIC_DIR,
  DIST_DIR,
};
