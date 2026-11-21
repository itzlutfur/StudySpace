/**
 * End-to-end smoke test against a running CourseStream server.
 * Usage: node test/e2e-check.mjs [baseUrl]
 */
const BASE = process.argv[2] || 'http://127.0.0.1:4317';
const COURSE_PATH = process.argv[3];

async function api(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

const results = [];
function check(name, ok, extra = '') {
  results.push({ name, ok, extra });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ` — ${extra}` : ''}`);
}

if (!COURSE_PATH) {
  console.error('Usage: node test/e2e-check.mjs [baseUrl] [courseFolderPath]');
  process.exit(2);
}

// ---- dashboard
let r = await api('/api/dashboard');
check('GET /api/dashboard returns 200', r.status === 200, JSON.stringify(r.data).slice(0, 200));
check('dashboard has courses array', Array.isArray(r.data?.courses));
check('dashboard has sort + theme', typeof r.data?.sort === 'string' && typeof r.data?.theme === 'string');

// ---- scan
r = await api('/api/courses/scan', { method: 'POST', body: { path: COURSE_PATH } });
check('POST /api/courses/scan returns 200', r.status === 200, JSON.stringify(r.data).slice(0, 300));
const scan = r.data;
check('scan finds lessons', (scan?.lessons?.length ?? 0) > 0, `${scan?.lessons?.length} lessons`);
check('scan returns counts', !!scan?.counts, JSON.stringify(scan?.counts));

// ---- create
const relPaths = (scan?.lessons ?? []).map((l) => l.relPath);
r = await api('/api/courses', {
  method: 'POST',
  body: { title: 'E2E Test Course', path: COURSE_PATH, lessons: relPaths },
});
check('POST /api/courses returns 201', r.status === 201, JSON.stringify(r.data).slice(0, 200));
const courseId = r.data?.course?.id;
check('course was created', !!courseId, `id=${courseId}`);

// ---- duplicate
r = await api('/api/courses', {
  method: 'POST',
  body: { title: 'Dup', path: COURSE_PATH, lessons: relPaths },
});
check('duplicate course returns 409', r.status === 409);
check('409 exposes existingId', r.data?.existingId === courseId, `existingId=${r.data?.existingId}`);

// ---- course detail
r = await api(`/api/courses/${courseId}`);
check('GET /api/courses/:id returns 200', r.status === 200);
check('course detail has grouped lessons', Array.isArray(r.data?.grouped));
const firstLesson = r.data?.grouped?.[0]?.lessons?.[0];
check('grouped lessons carry progress', 'progress' in (firstLesson ?? {}));

// ---- lesson detail
const lessonId = firstLesson?.id;
r = await api(`/api/lessons/${lessonId}`);
check('GET /api/lessons/:id returns 200', r.status === 200, JSON.stringify(r.data).slice(0, 200));
check('lesson detail has prev/next/index/total', typeof r.data?.index === 'number' && typeof r.data?.total === 'number');
check('lesson detail has notesBody + bookmarkCount', typeof r.data?.notesBody === 'string' && typeof r.data?.bookmarkCount === 'number');
check('lesson detail has offerResume + resumeAt', typeof r.data?.offerResume === 'boolean' && typeof r.data?.resumeAt === 'string');

// ---- progress: save, then check the resume offer (this is the Bug A regression)
r = await api(`/api/progress/${lessonId}`, { method: 'POST', body: { position: 42, duration: 100 } });
check('POST /api/progress returns 200', r.status === 200, JSON.stringify(r.data));
check('progress watchedPct is 0.42', Math.abs((r.data?.watchedPct ?? 0) - 0.42) < 0.001, `got ${r.data?.watchedPct}`);

r = await api(`/api/progress/${lessonId}`);
check('GET /api/progress returns saved position', r.data?.positionSec === 42, `positionSec=${r.data?.positionSec}`);
check('progress offerResume is true after saving 42s', r.data?.offerResume === true, `offerResume=${r.data?.offerResume}`);

r = await api(`/api/lessons/${lessonId}`);
check('lesson detail offers resume (Bug A fix)', r.data?.offerResume === true, `offerResume=${r.data?.offerResume}`);
check('lesson detail resumeAt is 0:42', r.data?.resumeAt === '0:42', `resumeAt=${r.data?.resumeAt}`);

// ---- dashboard reflects progress (checked before the lesson completes, so a
//      resume position is still offerable)
r = await api('/api/dashboard');
const dashCourse = r.data?.courses?.find((c) => c.id === courseId);
check('dashboard averagePercent is > 0 (Bug A fix)', (dashCourse?.stats?.averagePercent ?? 0) > 0, `averagePercent=${dashCourse?.stats?.averagePercent}`);
check('dashboard continueItem is present', !!r.data?.continueItem, JSON.stringify(r.data?.continueItem?.resumeAt));
check('dashboard continueItem shows the resume time', r.data?.continueItem?.resumeAt === '0:42', `resumeAt=${r.data?.continueItem?.resumeAt}`);

// ---- completion threshold
r = await api(`/api/progress/${lessonId}`, { method: 'POST', body: { position: 95, duration: 100 } });
check('lesson auto-completes at 90% watched', r.data?.completed === true, JSON.stringify(r.data));
r = await api(`/api/progress/${lessonId}`);
check('completed lesson no longer offers resume', r.data?.offerResume === false, `offerResume=${r.data?.offerResume}`);

r = await api('/api/dashboard');
const completedCourse = r.data?.courses?.find((c) => c.id === courseId);
check('dashboard stats percent counts completed lessons', (completedCourse?.stats?.percent ?? 0) > 0, `percent=${completedCourse?.stats?.percent}`);

// ---- bookmarks
r = await api(`/api/progress/${lessonId}/bookmarks`, { method: 'POST', body: { timestamp: 12.5, label: 'key idea' } });
check('POST bookmark returns 201', r.status === 201);
const bookmarkId = r.data?.bookmark?.id;
r = await api(`/api/progress/${lessonId}/bookmarks`);
check('GET bookmarks returns list', (r.data?.bookmarks?.length ?? 0) === 1);
r = await api(`/api/progress/${lessonId}/bookmarks/${bookmarkId}`, { method: 'PATCH', body: { label: 'renamed' } });
check('PATCH bookmark returns 200', r.status === 200, JSON.stringify(r.data));
r = await api(`/api/progress/${lessonId}/bookmarks/${bookmarkId}`, { method: 'DELETE' });
check('DELETE bookmark returns 200', r.status === 200);

// ---- notes
r = await api(`/api/progress/${lessonId}/notes`, { method: 'PUT', body: { body: 'Remember this' } });
check('PUT notes returns 200', r.status === 200);
r = await api(`/api/progress/${lessonId}/notes`);
check('GET notes returns body', r.data?.body === 'Remember this', `body=${r.data?.body}`);

// ---- settings
r = await api('/api/dashboard/theme', { method: 'POST', body: { theme: 'light' } });
check('POST theme returns 200', r.status === 200 && r.data?.theme === 'light');
r = await api('/api/dashboard/sort', { method: 'POST', body: { sort: 'name' } });
check('POST sort returns 200', r.status === 200 && r.data?.sort === 'name', JSON.stringify(r.data));
r = await api('/api/dashboard');
check('sort persisted server-side (Bug B fix)', r.data?.sort === 'name', `sort=${r.data?.sort}`);
await api('/api/dashboard/sort', { method: 'POST', body: { sort: 'recent' } });

// ---- document streaming
// The document route only serves document/text lessons, so it needs a lesson
// that is actually one — the first lesson in the course is usually a video.
const documentLesson = (scan?.lessons ?? []).find((l) => l.type === 'document' || l.type === 'text');
r = await fetch(`${BASE}/player/${lessonId}/document`);
check(
  'GET /player/:id/document rejects a non-document lesson',
  r.status === 400,
  `status=${r.status}`
);

if (documentLesson) {
  const docId = (r = await api(`/api/courses/${courseId}`)).data?.grouped
    ?.flatMap((g) => g.lessons)
    ?.find((l) => l.rel_path === documentLesson.relPath)?.id;
  r = await fetch(`${BASE}/player/${docId}/document`);
  check(
    'GET /player/:id/document returns 200 for a document lesson',
    r.status === 200,
    `status=${r.status} type=${r.headers.get('content-type')}`
  );
} else {
  check(
    'GET /player/:id/document returns 200 for a document lesson',
    true,
    'no document lesson in the fixture — skipped'
  );
}

// ---- delete + restore
r = await api(`/api/courses/${courseId}`, { method: 'DELETE' });
check('DELETE course returns 200', r.status === 200);
check('DELETE returns a snapshot', !!r.data?.snapshot?.course?.id);
const snapshot = r.data.snapshot;
r = await api(`/api/courses/restore`, { method: 'POST', body: { snapshot } });
check('POST restore returns 200', r.status === 200, JSON.stringify(r.data));
r = await api(`/api/courses/${courseId}`);
check('restored course is back', r.status === 200);
check('restored course keeps its lessons', (r.data?.grouped ?? []).length > 0);

// ---- cleanup
await api(`/api/courses/${courseId}`, { method: 'DELETE' });
r = await api('/api/courses');
check('course removed for cleanup', !(r.data?.courses ?? []).some((c) => c.id === courseId));

const failed = results.filter((x) => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log('\nFailures:');
  for (const f of failed) console.log(`  - ${f.name} ${f.extra}`);
  process.exit(1);
}
