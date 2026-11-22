import { apiFetch } from './client.js';

/**
 * Open the operating system's native folder picker and return the chosen
 * folder's absolute path.
 *
 * The dialog is raised by the server process, because a browser cannot reveal
 * the absolute path of a picked folder. The request stays open until the user
 * answers the dialog, so callers should expect it to take as long as the user
 * takes.
 *
 * Resolves with `null` when the user dismisses the dialog without choosing.
 */
export async function pickFolder() {
  const result = await apiFetch('/api/pick-folder', { method: 'POST' });
  if (result?.cancelled) return null;
  return result?.path ?? null;
}
