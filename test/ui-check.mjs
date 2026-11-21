/**
 * Browser smoke test for the React front-end.
 * Usage: node test/ui-check.mjs [baseUrl]
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://127.0.0.1:4317';
const COURSE_PATH = process.argv[3];

/**
 * Scan the fixture up front so the assertions can check against the real
 * lesson count rather than a hardcoded one.
 */
let expectedLessons = 0;
let expectedTextLessons = 0;
if (COURSE_PATH) {
  const res = await fetch(`${BASE}/api/courses/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: COURSE_PATH }),
  });
  const scan = await res.json();
  const lessons = scan?.lessons ?? [];
  expectedLessons = lessons.length;
  expectedTextLessons = lessons.filter((l) => l.type === 'text' || l.type === 'document').length;
}

const results = [];
function check(name, ok, extra = '') {
  results.push({ name, ok, extra });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ` — ${extra}` : ''}`);
}

const browser = await chromium.launch();
const page = await browser.newPage();

const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

try {
  /* -------------------- clean up leftovers -------------------- */
  // Remove any course left over from a previous run, so the test is repeatable.
  const existing = await (await fetch(`${BASE}/api/courses`)).json();
  for (const course of existing.courses ?? []) {
    await fetch(`${BASE}/api/courses/${course.id}`, { method: 'DELETE' });
  }

  /* -------------------- dashboard -------------------- */
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  check('page title', (await page.title()) === 'CourseStream');
  check('topbar renders', (await page.locator('.topbar').count()) === 1);
  check('theme toggle present', (await page.locator('#theme-toggle').count()) === 1);
  check('add course link present', (await page.locator('a[href="/courses/add"]').count()) >= 1);
  check('empty state shows', (await page.locator('.empty-state').count()) === 1);

  /* -------------------- add course -------------------- */
  await page.click('a[href="/courses/add"]');
  await page.waitForURL(/\/courses\/add$/, { timeout: 15000 });
  await page.waitForSelector('#path-input', { timeout: 15000 });
  check('add-course page renders', (await page.locator('#path-input').count()) === 1);
  check('dropzone renders', (await page.locator('#dropzone').count()) === 1);

  if (COURSE_PATH) {
    await page.fill('#path-input', COURSE_PATH);
    await page.click('#scan-btn');
    await page.waitForSelector('#step-review', { timeout: 15000 });
    check('review step renders', (await page.locator('#review-list').count()) === 1);
    check(
      'review shows lesson count',
      (await page.locator('#review-total').textContent())?.includes(String(expectedLessons)),
      `expected ${expectedLessons}`
    );
    // The review list has one checkbox per lesson plus one per section group,
    // so only the lesson-level rows are counted here.
    check(
      'review checkboxes exist',
      (await page.locator('#review-list .review-item input[type="checkbox"]').count()) >= expectedLessons
    );

    await page.fill('#title-input', 'UI Test Course');
    await page.click('#add-btn');
    await page.waitForURL(`${BASE}/`, { timeout: 15000 });
    await page.waitForSelector('.course-card', { timeout: 15000 });
    check('course card appears on dashboard', (await page.locator('.course-card').count()) === 1);
    check('course card shows title', (await page.locator('.course-card h3').textContent()) === 'UI Test Course');

    /* -------------------- search & sort -------------------- */
    await page.fill('#course-search', 'zzzznomatch');
    await page.waitForTimeout(300);
    check('no-match shows when search misses', (await page.locator('.no-match').count()) === 1);
    await page.fill('#course-search', 'UI Test');
    await page.waitForTimeout(300);
    check('search filters to the match', (await page.locator('.course-card').count()) === 1);
    await page.fill('#course-search', '');
    await page.waitForTimeout(300);

    await page.selectOption('#course-sort', 'name');
    await page.waitForTimeout(300);
    check('sort option applied', (await page.locator('#course-sort').inputValue()) === 'name');
    await page.selectOption('#course-sort', 'recent');
    await page.waitForTimeout(300);

    /* -------------------- theme toggle -------------------- */
    const themeBefore = await page.getAttribute('html', 'data-theme');
    await page.click('#theme-toggle');
    await page.waitForTimeout(300);
    const themeAfter = await page.getAttribute('html', 'data-theme');
    check('theme toggles', themeBefore !== themeAfter, `${themeBefore} -> ${themeAfter}`);
    await page.click('#theme-toggle');
    await page.waitForTimeout(300);

    /* -------------------- course detail -------------------- */
    await page.click('.course-open');
    await page.waitForURL(/\/courses\/\d+$/, { timeout: 15000 });
    await page.waitForSelector('.course-header', { timeout: 15000 });
    check('course detail renders', (await page.locator('.course-header').count()) === 1);
    check('stat strip renders', (await page.locator('.stat-strip .stat').count()) === 5);
    check('lesson groups render', (await page.locator('.lesson-item').count()) === expectedLessons);

    /* -------------------- player -------------------- */
    await page.click('.lesson-link');
    await page.waitForURL(/\/player\/\d+$/, { timeout: 15000 });
    await page.waitForSelector('#lesson-title', { timeout: 15000 });
    check('player renders', (await page.locator('#lesson-title').count()) === 1);
    check('sidebar renders', (await page.locator('#sidebar').count()) === 1);
    check('sidebar lists lessons', (await page.locator('.sidebar-lesson').count()) === expectedLessons);
    check('notes panel renders', (await page.locator('#notes').count()) === 1);
    check('bookmarks panel renders', (await page.locator('#bookmark-list').count()) === 1);
    check('complete button renders', (await page.locator('#complete-btn').count()) === 1);

    /* -------------------- text lesson -------------------- */
    // The first lesson is usually a video, so navigate to a text lesson
    // explicitly rather than assuming which one the sidebar highlights.
    if (expectedTextLessons > 0) {
      const textLink = page.locator('.sidebar-lesson', { hasText: 'Notes' }).first();
      if (await textLink.count()) {
        await textLink.click();
        await page.waitForTimeout(1200);
      }
      check('text lesson renders', (await page.locator('.text-lesson').count()) === 1);

      // Text lesson content: the markdown file should render as markdown.
      const textLesson = await page.locator('.text-lesson').textContent();
      check('text lesson content loads', (textLesson ?? '').length > 0, (textLesson ?? '').slice(0, 40));
    } else {
      check('text lesson renders', true, 'no text lesson in the fixture — skipped');
    }

    /* -------------------- notes autosave -------------------- */
    await page.fill('#notes', 'Note from the UI test');
    await page.waitForTimeout(1500);
    check('notes status shows saved', (await page.locator('#notes-status').textContent())?.includes('Saved'));

    /* -------------------- sidebar toggle -------------------- */
    await page.click('#sidebar-toggle');
    await page.waitForTimeout(200);
    check('sidebar can be hidden', (await page.locator('#player-layout.sidebar-hidden').count()) === 1);
    await page.click('#sidebar-toggle');
    await page.waitForTimeout(200);

    /* -------------------- complete toggle -------------------- */
    const completeTextBefore = await page.locator('#complete-btn').textContent();
    await page.click('#complete-btn');
    await page.waitForTimeout(700);
    const completeTextAfter = await page.locator('#complete-btn').textContent();
    check('complete button toggles', completeTextBefore !== completeTextAfter, `${completeTextBefore} -> ${completeTextAfter}`);

    /* -------------------- 404 route -------------------- */
    await page.goto(`${BASE}/this-route-does-not-exist`, { waitUntil: 'networkidle' });
    check('404 route renders the not-found page', (await page.locator('.empty-icon').count()) === 1);
    check('404 page links back to the library', (await page.locator('a[href="/"]').count()) >= 1);

    /* -------------------- cleanup -------------------- */
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await page.click('[data-menu-toggle]');
    await page.waitForTimeout(200);
    await page.click('button[data-action="remove"]');
    await page.waitForSelector('.modal', { timeout: 5000 });
    check('remove confirm modal opens', (await page.locator('.modal').count()) === 1);
    await page.click('.modal .btn-danger');
    await page.waitForTimeout(1200);
    check('course removed after confirm', (await page.locator('.course-card').count()) === 0);
  }

  check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
} catch (err) {
  check('test run completed without throwing', false, err.message);
} finally {
  await browser.close();
}

const failed = results.filter((x) => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log('\nFailures:');
  for (const f of failed) console.log(`  - ${f.name} ${f.extra}`);
  process.exit(1);
}
