import { apiFetch } from './client.js';

/** List a folder on disk for the folder picker. */
export function browse(path) {
  const query = path ? `?path=${encodeURIComponent(path)}` : '';
  return apiFetch(`/api/browse${query}`);
}
