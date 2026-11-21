import path from 'node:path';

export const VIDEO_EXTENSIONS = new Set([
  '.mp4', '.m4v', '.webm', '.mkv', '.mov', '.avi', '.flv', '.wmv',
  '.mpg', '.mpeg', '.ts', '.ogv', '.3gp',
]);

export const AUDIO_EXTENSIONS = new Set([
  '.mp3', '.m4a', '.aac', '.wav', '.flac', '.ogg', '.opus', '.wma', '.aiff',
]);

export const DOCUMENT_EXTENSIONS = new Set(['.pdf', '.epub']);

export const TEXT_EXTENSIONS = new Set(['.md', '.markdown', '.txt', '.html', '.htm']);

/** Containers the browser cannot natively play — warn the user, never transcode. */
export const BROWSER_UNSUPPORTED_VIDEO = new Set(['.mkv', '.avi', '.flv', '.wmv', '.mpg', '.mpeg', '.ts', '.ogv', '.3gp']);

const MIME_BY_EXT = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.flv': 'video/x-flv',
  '.wmv': 'video/x-ms-wmv',
  '.mpg': 'video/mpeg',
  '.mpeg': 'video/mpeg',
  '.ts': 'video/mp2t',
  '.ogv': 'video/ogg',
  '.3gp': 'video/3gpp',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/opus',
  '.wma': 'audio/x-ms-wma',
  '.aiff': 'audio/aiff',
  '.pdf': 'application/pdf',
  '.epub': 'application/epub+zip',
  '.md': 'text/markdown; charset=utf-8',
  '.markdown': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
};

export function extOf(filePath) {
  return path.extname(String(filePath ?? '')).toLowerCase();
}

/** Classify a file into a lesson type. Returns null when unsupported. */
export function classify(filePath) {
  const ext = extOf(filePath);
  if (VIDEO_EXTENSIONS.has(ext)) return 'video';
  if (AUDIO_EXTENSIONS.has(ext)) return 'audio';
  if (DOCUMENT_EXTENSIONS.has(ext)) return 'document';
  if (TEXT_EXTENSIONS.has(ext)) return 'text';
  return null;
}

/** MIME type for a file path, with a safe generic fallback. */
export function mimeFor(filePath) {
  const ext = extOf(filePath);
  return MIME_BY_EXT[ext] ?? 'application/octet-stream';
}

/** True when the browser is unlikely to play this container natively. */
export function isUnplayableInBrowser(filePath) {
  const ext = extOf(filePath);
  return BROWSER_UNSUPPORTED_VIDEO.has(ext);
}

/**
 * Parse an HTTP Range header against a known size.
 * Returns null when the header is absent, or { start, end } when satisfiable.
 * Throws { status: 416 } semantics via a returned `invalid` flag.
 */
export function parseRange(header, size) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(header).trim());
  if (!match) return { invalid: true };

  const [, rawStart, rawEnd] = match;
  if (rawStart === '' && rawEnd === '') return { invalid: true };

  let start;
  let end;

  if (rawStart === '') {
    // suffix range: last N bytes
    const suffix = Number(rawEnd);
    if (!Number.isFinite(suffix) || suffix <= 0) return { invalid: true };
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd === '' ? size - 1 : Number(rawEnd);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return { invalid: true };
    if (end >= size) end = size - 1;
  }

  if (start > end || start < 0 || start >= size) return { invalid: true };
  return { start, end };
}

export default {
  VIDEO_EXTENSIONS,
  AUDIO_EXTENSIONS,
  DOCUMENT_EXTENSIONS,
  TEXT_EXTENSIONS,
  extOf,
  classify,
  mimeFor,
  isUnplayableInBrowser,
  parseRange,
};
