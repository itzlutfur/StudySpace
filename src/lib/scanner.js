import fs from 'node:fs/promises';
import path from 'node:path';
import { classify, extOf, isUnplayableInBrowser } from './media.js';
import { SCAN } from '../config.js';
import { relativeKey } from './paths.js';

const ORDER_PREFIX = /^\s*(?:\[?\d{1,3}\]?)[.\s_\-–—:]*(?=\D)/;

/** Files that act as course-level documents rather than lessons. */
const OVERVIEW_NAMES = new Set(['notes.md', 'readme.md', 'notes.txt', 'readme.txt', 'index.md']);

/**
 * Natural (numeric-aware) comparison so "2-intro" sorts before "10-advanced".
 */
export function naturalCompare(a, b) {
  const ax = [];
  const bx = [];
  const re = /(\d+)|(\D+)/g;
  let m;
  while ((m = re.exec(a)) !== null) ax.push(m[1] !== undefined ? Number(m[1]) : m[2].toLowerCase());
  while ((m = re.exec(b)) !== null) bx.push(m[1] !== undefined ? Number(m[1]) : m[2].toLowerCase());

  const len = Math.min(ax.length, bx.length);
  for (let i = 0; i < len; i++) {
    const x = ax[i];
    const y = bx[i];
    if (typeof x === 'number' && typeof y === 'number') {
      if (x !== y) return x - y;
    } else if (x !== y) {
      return String(x) < String(y) ? -1 : 1;
    }
  }
  return ax.length - bx.length;
}

/** Strip a leading "01 - " style ordering prefix from a display title. */
export function cleanTitle(fileName) {
  const base = fileName.replace(/\.[^.]+$/, '');
  const stripped = base.replace(ORDER_PREFIX, '').trim();
  return stripped || base;
}

/** Turn a folder name into a readable chapter title. */
export function cleanSection(folderName) {
  if (!folderName) return '';
  return folderName.replace(/^\s*\d{1,3}[.\s_\-–—:]*/, '').trim() || folderName;
}

function isIgnored(name) {
  if (name.startsWith('.')) return true;
  if (SCAN.ignoredNames.has(name)) return true;
  return SCAN.ignoredExtensions.has(extOf(name));
}

/**
 * Recursively collect media/document files under `dir`.
 * Returns { files, truncated, skipped } where files are absolute paths.
 */
async function collectFiles(dir, root, depth, acc) {
  if (depth > SCAN.maxDepth) return;
  if (acc.length >= SCAN.maxFiles) return;

  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return; // unreadable directory — skip silently, caller reports a warning
  }

  for (const entry of entries) {
    if (acc.length >= SCAN.maxFiles) break;
    if (isIgnored(entry.name)) continue;

    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await collectFiles(full, root, depth + 1, acc);
      continue;
    }
    if (!entry.isFile()) continue;

    if (!classify(full)) continue;

    // A notes/readme at the course root is an overview, not a lesson.
    if (depth === 0 && OVERVIEW_NAMES.has(entry.name.toLowerCase())) {
      acc.overview = full;
      continue;
    }

    acc.files.push(full);
  }
}

/**
 * Scan a course folder and build the lesson list.
 *
 * Returns {
 *   root, title, lessons: [{ relPath, absPath, title, section, type, sizeBytes, warn }],
 *   sections: [{ name, count }],
 *   counts: { video, audio, document, text },
 *   overview: string|null,
 *   warnings: string[]
 * }
 */
export async function scanFolder(rootPath) {
  const root = path.resolve(rootPath);
  const warnings = [];

  const stat = await fs.stat(root);
  if (!stat.isDirectory()) {
    throw new Error('Not a directory');
  }

  const acc = { files: [], overview: null };
  await collectFiles(root, root, 0, acc);

  if (acc.files.length >= SCAN.maxFiles) {
    warnings.push(`Folder contains more than ${SCAN.maxFiles} files; some were not scanned.`);
  }

  // Group by subfolder -> section. Root-level files form the first section.
  const groups = new Map();
  for (const file of acc.files) {
    const rel = relativeKey(root, file);
    const dir = path.posix.dirname(rel);
    const section = dir === '.' ? '' : dir.split('/').join(' / ');
    if (!groups.has(section)) groups.set(section, []);
    groups.get(section).push({ file, rel });
  }

  const sections = [];
  const lessons = [];

  // Root section first, then subfolders sorted naturally.
  const sectionNames = [...groups.keys()].sort((a, b) => {
    if (a === '') return -1;
    if (b === '') return 1;
    return naturalCompare(a, b);
  });

  for (const sectionName of sectionNames) {
    const entries = groups.get(sectionName).sort((a, b) => naturalCompare(a.file, b.file));
    sections.push({ name: sectionName, count: entries.length });

    for (const { file, rel } of entries) {
      const type = classify(file);
      let sizeBytes = null;
      try {
        sizeBytes = (await fs.stat(file)).size;
      } catch {
        /* keep null */
      }

      const warn = type === 'video' && isUnplayableInBrowser(file)
        ? 'This container may not play in your browser (no transcoding is performed).'
        : null;

      lessons.push({
        relPath: rel,
        absPath: file,
        title: cleanTitle(path.basename(file)),
        section: cleanSection(sectionName),
        sectionRaw: sectionName,
        type,
        sizeBytes,
        warn,
      });
    }
  }

  const counts = { video: 0, audio: 0, document: 0, text: 0 };
  for (const lesson of lessons) counts[lesson.type] = (counts[lesson.type] ?? 0) + 1;

  if (lessons.length === 0) {
    warnings.push('No video, audio, or document files were found in this folder.');
  }

  return {
    root,
    title: path.basename(root) || root,
    lessons,
    sections,
    counts,
    overview: acc.overview ? relativeKey(root, acc.overview) : null,
    warnings,
  };
}

/**
 * Scan and also list the immediate subdirectories, so the add-course flow can
 * offer "add this subfolder as its own course".
 */
export async function listSubfolders(rootPath) {
  const root = path.resolve(rootPath);
  const out = [];
  let entries;
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    out.push({ name: entry.name, path: path.join(root, entry.name) });
  }
  return out.sort((a, b) => naturalCompare(a.name, b.name));
}

export default { scanFolder, listSubfolders, naturalCompare, cleanTitle, cleanSection };
