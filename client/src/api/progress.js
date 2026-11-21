import { apiFetch } from './client.js';

/** The playback progress for a lesson. Creates the row if it is missing. */
export function fetchProgress(lessonId) {
  return apiFetch(`/api/progress/${lessonId}`);
}

/** Save the playback position. `watched_pct` only ever grows. */
export function saveProgress(lessonId, position, duration) {
  return apiFetch(`/api/progress/${lessonId}`, {
    method: 'POST',
    body: { position, duration },
  });
}

/** Mark a lesson complete or incomplete. */
export function setCompleted(lessonId, completed) {
  return apiFetch(`/api/progress/${lessonId}/complete`, { method: 'POST', body: { completed } });
}

/* ---------------------------- bookmarks -------------------------- */

export function fetchBookmarks(lessonId) {
  return apiFetch(`/api/progress/${lessonId}/bookmarks`);
}

export function addBookmark(lessonId, timestamp, label = '') {
  return apiFetch(`/api/progress/${lessonId}/bookmarks`, {
    method: 'POST',
    body: { timestamp, label },
  });
}

export function renameBookmark(lessonId, bookmarkId, label) {
  return apiFetch(`/api/progress/${lessonId}/bookmarks/${bookmarkId}`, {
    method: 'PATCH',
    body: { label },
  });
}

export function deleteBookmark(lessonId, bookmarkId) {
  return apiFetch(`/api/progress/${lessonId}/bookmarks/${bookmarkId}`, { method: 'DELETE' });
}

/* ------------------------------ notes ---------------------------- */

export function fetchNotes(lessonId) {
  return apiFetch(`/api/progress/${lessonId}/notes`);
}

export function saveNotes(lessonId, body) {
  return apiFetch(`/api/progress/${lessonId}/notes`, { method: 'PUT', body: { body } });
}
