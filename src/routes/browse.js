import express from 'express';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { normalizeInputPath, pathSegments, parentDir } from '../lib/paths.js';
import { classify } from '../lib/media.js';

const router = express.Router();

/** Sensible starting points for the folder picker. */
function defaultRoots() {
  const home = os.homedir();
  const roots = [
    { name: 'Home', path: home },
    { name: 'Downloads', path: path.join(home, 'Downloads') },
    { name: 'Desktop', path: path.join(home, 'Desktop') },
    { name: 'Videos', path: path.join(home, 'Videos') },
    { name: 'Documents', path: path.join(home, 'Documents') },
  ];
  if (process.platform === 'win32') {
    const drives = [];
    for (const letter of 'CDEFGH'.split('')) {
      const p = `${letter}:\\`;
      if (fsSyncExists(p)) drives.push({ name: `${letter}:`, path: p });
    }
    roots.unshift(...drives);
  }
  return roots;
}

function fsSyncExists(p) {
  try {
    return fsSync.existsSync(p);
  } catch {
    return false;
  }
}

/**
 * GET /api/browse?path=<dir>
 * Returns a directory listing for the in-app folder picker.
 */
router.get('/', async (req, res) => {
  const raw = req.query.path ? String(req.query.path) : os.homedir();
  const target = normalizeInputPath(raw) || os.homedir();

  let entries;
  try {
    entries = await fs.readdir(target, { withFileTypes: true });
  } catch (err) {
    return res.status(400).json({
      error: 'Could not read that folder',
      detail: err.code === 'ENOENT' ? 'The folder does not exist.' : err.message,
      path: target,
    });
  }

  const dirs = [];
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (entry.name === 'node_modules' || entry.name === '$RECYCLE.BIN') continue;
    const full = path.join(target, entry.name);
    if (entry.isDirectory()) {
      dirs.push({ name: entry.name, path: full, type: 'dir' });
    } else if (entry.isFile() && classify(full)) {
      files.push({ name: entry.name, path: full, type: 'file' });
    }
  }

  dirs.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  const { root, parts } = pathSegments(target);
  const breadcrumbs = [];
  let acc = root;
  for (const part of parts) {
    acc = path.join(acc, part);
    breadcrumbs.push({ name: part, path: acc });
  }

  res.json({
    path: target,
    parent: path.resolve(target) === path.resolve(root) ? null : parentDir(target),
    breadcrumbs,
    dirs,
    files,
    roots: defaultRoots(),
  });
});

export default router;
