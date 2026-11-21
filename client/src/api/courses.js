import { apiFetch } from './client.js';

/* --------------------------- library --------------------------- */

/** The dashboard: courses, the continue-watching card and preferences. */
export function fetchDashboard() {
  return apiFetch('/api/dashboard');
}

/** One course with its lessons, grouped by section. */
export function fetchCourse(id) {
  return apiFetch(`/api/courses/${id}`);
}

/* --------------------------- scanning -------------------------- */

/** Scan a folder and return the detected lessons for review. */
export function scanFolder(path) {
  return apiFetch('/api/courses/scan', { method: 'POST', body: { path } });
}

/**
 * Create a course from a reviewed scan.
 * `lessons` is a list of relative path strings.
 */
export function createCourse({ title, path, lessons }) {
  return apiFetch('/api/courses', { method: 'POST', body: { title, path, lessons } });
}

/* ------------------------ course actions ----------------------- */

export function renameCourse(id, title) {
  return apiFetch(`/api/courses/${id}`, { method: 'PATCH', body: { title } });
}

/** Re-detect lessons for an existing course. */
export function rescanCourse(id) {
  return apiFetch(`/api/courses/${id}/rescan`, { method: 'POST' });
}

/** Remove a course. Returns a snapshot that can be restored. */
export function deleteCourse(id) {
  return apiFetch(`/api/courses/${id}`, { method: 'DELETE' });
}

/** Undo a removal. */
export function restoreCourse(snapshot) {
  return apiFetch('/api/courses/restore', { method: 'POST', body: { snapshot } });
}

/* --------------------------- settings -------------------------- */

export function saveTheme(theme) {
  return apiFetch('/api/dashboard/theme', { method: 'POST', body: { theme } });
}

export function saveSort(sort) {
  return apiFetch('/api/dashboard/sort', { method: 'POST', body: { sort } });
}
