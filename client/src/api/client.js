/**
 * A thin fetch wrapper for the CourseStream JSON API.
 *
 * Errors carry the HTTP status and the parsed body, so callers can react to
 * specific failures — e.g. the 409 "course already exists" response, which
 * exposes `existingId` so the UI can offer to open that course instead.
 */
export async function apiFetch(url, options = {}) {
  const { body, headers, ...rest } = options;

  const init = {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (body !== undefined && body !== null && typeof body !== 'string') {
    init.body = JSON.stringify(body);
  } else if (typeof body === 'string') {
    init.body = body;
  }

  const res = await fetch(url, init);

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

/** Fetch a text resource (used for text lessons). */
export async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.text();
}
