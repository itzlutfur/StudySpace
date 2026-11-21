import path from 'node:path';
import os from 'node:os';

/**
 * Normalise a user-typed path: expand ~, convert separators, strip trailing
 * separators. On Windows, forward slashes are converted to backslashes so
 * path.resolve behaves consistently. On POSIX, backslashes are legal filename
 * characters and are left alone.
 */
export function normalizeInputPath(input) {
  if (typeof input !== 'string') return '';
  let p = input.trim().replace(/^['"]|['"]$/g, '');
  if (!p) return '';

  if (path.sep === '\\') {
    p = p.replace(/\//g, '\\');
  }

  if (p === '~' || p.startsWith(`~${path.sep}`) || (path.sep === '\\' && p.startsWith('~\\'))) {
    p = path.join(os.homedir(), p.slice(1));
  }
  // Windows drive-relative forms like "C:foo" -> "C:\foo"
  const driveMatch = /^([a-zA-Z]:)$/.exec(p);
  if (driveMatch) p = `${driveMatch[1]}${path.sep}`;

  p = path.normalize(p);
  if (p.length > 1) p = p.replace(/[\\/]+$/, '');
  return p;
}

/** Resolve a path to an absolute one, returning null when invalid. */
export function resolvePath(input) {
  const norm = normalizeInputPath(input);
  if (!norm) return null;
  return path.resolve(norm);
}

/**
 * True when `child` is inside `parent` (or is `parent` itself).
 * Used to guarantee media requests never escape the course root.
 */
export function isInside(parent, child) {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  if (rel === '') return true;
  if (path.isAbsolute(rel)) return false;
  return !rel.split(path.sep).includes('..');
}

/** Path relative to a root, always using forward slashes for stable keys. */
export function relativeKey(root, target) {
  return path.relative(path.resolve(root), path.resolve(target)).split(path.sep).join('/');
}

/** Join a root and a relative key back into an absolute path. */
export function resolveRelPath(root, relKey) {
  const parts = String(relKey ?? '')
    .split('/')
    .filter((p) => p && p !== '.' && p !== '..');
  return path.join(path.resolve(root), ...parts);
}

/** The directory portion of a path, for breadcrumb building. */
export function parentDir(p) {
  return path.dirname(path.resolve(p));
}

/** Split a path into its individual name segments, for breadcrumbs. */
export function pathSegments(p) {
  const resolved = path.resolve(p);
  const parts = resolved.split(path.sep).filter(Boolean);
  const root = path.parse(resolved).root;
  return { root, parts };
}

export default {
  normalizeInputPath,
  resolvePath,
  isInside,
  relativeKey,
  resolveRelPath,
  parentDir,
  pathSegments,
};
