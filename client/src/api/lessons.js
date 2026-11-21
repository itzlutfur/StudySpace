import { apiFetch } from './client.js';

/** Everything the player screen needs for one lesson. */
export function fetchLesson(lessonId) {
  return apiFetch(`/api/lessons/${lessonId}`);
}
