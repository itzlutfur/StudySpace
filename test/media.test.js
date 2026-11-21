import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mimeFor, parseRange, classify, extOf, isUnplayableInBrowser } from '../src/lib/media.js';
import { isInside, relativeKey, resolveRelPath, normalizeInputPath } from '../src/lib/paths.js';

test('extOf returns the lowercase extension', () => {
  assert.equal(extOf('/a/b/Video.MP4'), '.mp4');
  assert.equal(extOf('/a/b/noext'), '');
});

test('classify detects lesson types', () => {
  assert.equal(classify('/a/lesson.mp4'), 'video');
  assert.equal(classify('/a/lesson.mp3'), 'audio');
  assert.equal(classify('/a/book.pdf'), 'document');
  assert.equal(classify('/a/notes.md'), 'text');
  assert.equal(classify('/a/image.png'), null);
});

test('mimeFor maps extensions to content types', () => {
  assert.equal(mimeFor('/a/lesson.mp4'), 'video/mp4');
  assert.equal(mimeFor('/a/book.pdf'), 'application/pdf');
  assert.match(mimeFor('/a/notes.md'), /^text\/markdown/);
  assert.equal(mimeFor('/a/unknown.xyz'), 'application/octet-stream');
});

test('isUnplayableInBrowser flags containers browsers cannot play', () => {
  assert.equal(isUnplayableInBrowser('/a/clip.mkv'), true);
  assert.equal(isUnplayableInBrowser('/a/clip.avi'), true);
  assert.equal(isUnplayableInBrowser('/a/clip.mp4'), false);
});

test('parseRange handles a full request', () => {
  assert.equal(parseRange(undefined, 1000), null);
  assert.equal(parseRange('', 1000), null);
});

test('parseRange handles an explicit range', () => {
  assert.deepEqual(parseRange('bytes=0-499', 1000), { start: 0, end: 499 });
  assert.deepEqual(parseRange('bytes=500-999', 1000), { start: 500, end: 999 });
});

test('parseRange handles an open-ended range', () => {
  assert.deepEqual(parseRange('bytes=500-', 1000), { start: 500, end: 999 });
});

test('parseRange handles a suffix range', () => {
  assert.deepEqual(parseRange('bytes=-500', 1000), { start: 500, end: 999 });
  assert.deepEqual(parseRange('bytes=-2000', 1000), { start: 0, end: 999 });
});

test('parseRange rejects out-of-bounds ranges', () => {
  assert.deepEqual(parseRange('bytes=2000-3000', 1000), { invalid: true });
  assert.deepEqual(parseRange('bytes=abc', 1000), { invalid: true });
});

test('isInside rejects path traversal', () => {
  assert.equal(isInside('C:\\course', 'C:\\course\\lesson.mp4'), true);
  assert.equal(isInside('C:\\course', 'C:\\course'), true);
  assert.equal(isInside('C:\\course', 'C:\\course\\..\\secret.mp4'), false);
  assert.equal(isInside('C:\\course', 'C:\\other\\secret.mp4'), false);
});

test('relativeKey and resolveRelPath round trip', () => {
  const root = 'C:\\course';
  const target = 'C:\\course\\Chapter 1\\01 - Intro.mp4';
  const key = relativeKey(root, target);
  assert.equal(key, 'Chapter 1/01 - Intro.mp4');
  assert.equal(resolveRelPath(root, key), target);
});

test('normalizeInputPath strips quotes and expands home', () => {
  assert.equal(normalizeInputPath('  "C:\\Videos\\course"  '), 'C:\\Videos\\course');
  // `~` expands to the user's home directory.
  assert.equal(normalizeInputPath('~/videos'), `${process.env.HOME ?? process.env.USERPROFILE}\\videos`);
});
