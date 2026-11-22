import fs from 'node:fs/promises';

/**
 * Read the duration of an MP4/M4A container from its `mvhd` atom.
 *
 * The app has no media decoder and will never get one — transcoding is out of
 * scope. But an ISO-BMFF container carries its own duration in the header, so
 * the common case (`.mp4`, `.m4v`, `.m4a`) can be read with a plain file read.
 *
 * Only the header is read — a few hundred kilobytes at most — so this stays
 * cheap enough to run during a scan.
 *
 * Returns the duration in seconds, or `null` when it cannot be read. A `null`
 * is honest: the UI renders an em dash rather than a made-up number.
 */

/** Containers whose header carries a readable `mvhd` atom. */
const ISO_BMFF_EXTENSIONS = new Set(['.mp4', '.m4v', '.m4a']);

/** How much of the file header to read. `moov` can sit past 1 MB in rare files. */
const HEADER_READ_BYTES = 2 * 1024 * 1024;

/**
 * Walk the ISO-BMFF box structure looking for `moov`, then `mvhd` inside it.
 * Returns the box payload of `mvhd`, or null.
 */
function findMvhd(buffer) {
  let offset = 0;

  while (offset + 8 <= buffer.length) {
    const size = buffer.readUInt32BE(offset);
    const type = buffer.toString('latin1', offset + 4, offset + 8);

    // A size of 1 means the real size is a 64-bit value that follows; a size
    // of 0 means "runs to the end of the file". Both are handled by treating
    // the box as "too big to be in our buffer" and stopping the walk.
    if (size === 1) {
      const largeSize = Number(buffer.readBigUInt64BE(offset + 8));
      if (!Number.isFinite(largeSize) || largeSize > buffer.length) return null;
      if (type === 'moov') return findMvhdInMoov(buffer.subarray(offset + 16, offset + Number(largeSize)));
      offset += Number(largeSize);
      continue;
    }

    if (size === 0) {
      if (type === 'moov') return findMvhdInMoov(buffer.subarray(offset + 8));
      return null;
    }

    if (size < 8) return null;

    if (type === 'moov') {
      return findMvhdInMoov(buffer.subarray(offset + 8, Math.min(offset + size, buffer.length)));
    }

    offset += size;
  }

  return null;
}

/** Locate `mvhd` within the `moov` box payload. */
function findMvhdInMoov(moov) {
  let offset = 0;

  while (offset + 8 <= moov.length) {
    const size = moov.readUInt32BE(offset);
    const type = moov.toString('latin1', offset + 4, offset + 8);

    if (size === 1) {
      const largeSize = Number(moov.readBigUInt64BE(offset + 8));
      if (!Number.isFinite(largeSize) || largeSize > moov.length) return null;
      offset += Number(largeSize);
      continue;
    }

    if (size < 8) return null;

    if (type === 'mvhd') {
      return moov.subarray(offset + 8, Math.min(offset + size, moov.length));
    }

    offset += size;
  }

  return null;
}

/**
 * Decode the `mvhd` payload into a duration in seconds.
 *
 * Version 0 stores the timescale and duration as 32-bit values; version 1
 * widens them to 64-bit. Both are handled.
 */
function decodeMvhd(mvhd) {
  if (!mvhd || mvhd.length < 4) return null;

  const version = mvhd[0];
  const base = version === 1 ? 20 : 12;

  if (mvhd.length < base + 8) return null;

  const timescale = mvhd.readUInt32BE(base);
  if (!timescale) return null;

  const rawDuration =
    version === 1 ? Number(mvhd.readBigUInt64BE(base + 4)) : mvhd.readUInt32BE(base + 4);

  if (!Number.isFinite(rawDuration) || rawDuration <= 0) return null;

  const seconds = rawDuration / timescale;
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

/**
 * The duration of a media file in seconds, or null when it cannot be read.
 *
 * Only ISO-BMFF containers are probed. Everything else (MKV, WebM, MP3, …)
 * returns null — the UI shows "—" for those, which is the honest answer.
 */
export async function probeDuration(filePath) {
  const lower = String(filePath ?? '').toLowerCase();
  if (!ISO_BMFF_EXTENSIONS.has(lower.slice(lower.lastIndexOf('.')))) return null;

  let handle;
  try {
    handle = await fs.open(filePath, 'r');
  } catch {
    return null;
  }

  try {
    const stat = await handle.stat();
    const length = Math.min(HEADER_READ_BYTES, stat.size);
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, 0);
    if (!bytesRead) return null;

    return decodeMvhd(findMvhd(buffer.subarray(0, bytesRead)));
  } catch {
    return null;
  } finally {
    await handle.close().catch(() => {});
  }
}

export default { probeDuration };
