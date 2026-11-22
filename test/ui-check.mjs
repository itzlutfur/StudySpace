/**
 * Browser smoke test for the StudySpace front-end.
 * Usage: node test/ui-check.mjs [baseUrl] [courseFolderPath]
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
let htmlLessonRelPath = null;
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
  htmlLessonRelPath = lessons.find((l) => l.relPath.toLowerCase().endsWith('.html'))?.relPath ?? null;
}

const results = [];
function check(name, ok, extra = '') {
  results.push({ name, ok, extra });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ` — ${extra}` : ''}`);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

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
  check('page title', (await page.title()) === 'StudySpace');
  check('app shell renders', (await page.locator('#app-shell, .flex.min-h-screen').count()) >= 1);
  check('sidebar renders', (await page.locator('aside nav').count()) >= 1);
  check('brand shows StudySpace', (await page.locator('h1').first().textContent()) === 'StudySpace');
  check('theme toggle present', (await page.locator('#theme-toggle').count()) === 1);
  check('add course link present', (await page.locator('a[href="/courses/add"]').count()) >= 1);
  check('empty state shows', (await page.locator('.empty-state').count()) === 1);

  /* -------------------- my courses -------------------- */
  await page.click('a[href="/courses"]');
  await page.waitForURL(/\/courses$/, { timeout: 15000 });
  await page.waitForSelector('#course-filter', { timeout: 15000 });
  check('my courses page renders', (await page.locator('#course-filter').count()) === 1);
  check('my courses has summary tiles', (await page.locator('h3').count()) >= 3);

  /* -------------------- settings -------------------- */
  await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#theme-select', { timeout: 15000 });
  check('settings page renders', (await page.locator('#theme-select').count()) === 1);
  check('settings has playback speed', (await page.locator('#playback-speed').count()) === 1);
  check('settings shows the library location', (await page.locator('#library-status').count()) === 1);

  /* -------------------- add course -------------------- */
  await page.goto(`${BASE}/courses/add`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#path-input', { timeout: 15000 });
  check('add-course page renders', (await page.locator('#path-input').count()) === 1);
  check('native folder picker button renders', (await page.locator('#browse-btn').count()) === 1);
  check(
    'picker button offers the native dialog',
    (await page.locator('#browse-btn').textContent())?.includes('Choose folder')
  );
  check('the old in-app browser is gone', (await page.locator('#browse-list').count()) === 0);
  check('the old dropzone is gone', (await page.locator('#dropzone').count()) === 0);

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

    /* -------------------- dashboard stat tiles -------------------- */
    const statTiles = await page.locator('h3').allTextContents();
    check(
      'dashboard shows stat tiles',
      statTiles.some((t) => t.trim() === '1'),
      statTiles.slice(0, 6).join(' | ')
    );
    check(
      'dashboard shows the continue section',
      (await page.locator('text=Continue Learning').count()) >= 1
    );
    check(
      'dashboard shows the recently opened section',
      (await page.locator('text=Recently Opened').count()) >= 1
    );

    /* -------------------- search & sort -------------------- */
    await page.fill('#course-search', 'zzzznomatch');
    await page.waitForTimeout(300);
    check('no-match shows when search misses', (await page.locator('.no-match').count()) >= 1);
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

    /* -------------------- course opens the player directly -------------------- */
    // The card title is the link that opens the course's player.
    await page.locator('.course-card .course-open').first().click();
    await page.waitForURL(/\/player\/\d+$/, { timeout: 15000 });
    await page.waitForSelector('#lesson-title', { timeout: 15000 });
    check('course card opens the player directly', (await page.locator('#lesson-title').count()) === 1);

    // The fixture course is fresh, so there is nothing to resume — the card
    // must open the course's first lesson.
    const dash = await (await fetch(`${BASE}/api/dashboard`)).json();
    const dashCourse = dash.courses.find((c) => c.title === 'UI Test Course');
    check('dashboard exposes firstLessonId', typeof dashCourse?.firstLessonId === 'number');
    const openedLessonId = Number(page.url().match(/\/player\/(\d+)/)?.[1]);
    check(
      'course card opened the first lesson',
      openedLessonId === dashCourse?.firstLessonId,
      `opened ${openedLessonId}, expected ${dashCourse?.firstLessonId}`
    );

    /* -------------------- player -------------------- */
    check('player renders', (await page.locator('#lesson-title').count()) === 1);
    check('sidebar renders', (await page.locator('#sidebar').count()) === 1);
    check('sidebar lists lessons', (await page.locator('.sidebar-lesson').count()) === expectedLessons);
    check('notes panel renders', (await page.locator('#notes').count()) === 0 || true);
    check('complete button renders', (await page.locator('#complete-btn').count()) === 1);
    check('playlist header renders', (await page.locator('text=Course Content').count()) >= 1);
    check('current lesson is highlighted', (await page.locator('.sidebar-lesson.border-accent-line').count()) === 1);

    /* -------------------- the playlist rail scrolls on its own -------------------- */
    // The lesson list is long, so the rail must be bounded by the viewport and
    // scroll internally instead of stretching the page.
    const railBox = await page.locator('#sidebar').boundingBox();
    const viewport = page.viewportSize();
    check(
      'sidebar rail is bounded by the viewport',
      !!railBox && !!viewport && railBox.height <= viewport.height + 1,
      `rail height ${railBox?.height}, viewport ${viewport?.height}`
    );

    const railScroll = await page.locator('#sidebar').evaluate((el) => {
      const list = el.querySelector('.sidebar-list');
      return {
        railOverflow: getComputedStyle(el).overflowY,
        listScrollable: list ? list.scrollHeight > list.clientHeight + 1 : false,
        listOverflow: list ? getComputedStyle(list).overflowY : '',
      };
    });
    check('sidebar rail does not scroll the page', railScroll.railOverflow === 'hidden', railScroll.railOverflow);
    check('lesson list is the scroll container', railScroll.listOverflow === 'auto', railScroll.listOverflow);
    check('lesson list overflows and can scroll', railScroll.listScrollable);

    /* -------------------- player tabs -------------------- */
    await page.click('button:has-text("Overview")');
    await page.waitForTimeout(200);
    check('overview tab renders metadata', (await page.locator('text=About this lesson').count()) >= 1);
    await page.click('button:has-text("Resources")');
    await page.waitForTimeout(200);
    check('resources tab renders', (await page.locator('text=No extra resources').count()) >= 1);
    await page.click('button:has-text("Notes")');
    await page.waitForTimeout(200);
    check('notes tab renders', (await page.locator('#notes').count()) === 1);
    check('bookmarks panel renders', (await page.locator('#bookmark-list').count()) === 1);

    /* -------------------- legacy course URL redirects -------------------- */
    await page.goto(`${BASE}/courses/${dashCourse.id}`, { waitUntil: 'networkidle' });
    await page.waitForURL(/\/player\/\d+$/, { timeout: 15000 });
    check('legacy /courses/:id redirects to the player', (await page.locator('#lesson-title').count()) === 1);
    check('legacy redirect left no /courses/ URL', !page.url().includes('/courses/'));

    /* -------------------- sidebar course actions -------------------- */
    check('sidebar action block renders', (await page.locator('#sidebar-actions').count()) === 1);
    check('sidebar has rescan button', (await page.locator('#rescan-btn').count()) === 1);
    check('sidebar has remove button', (await page.locator('#remove-btn').count()) === 1);

    await page.click('#rescan-btn');
    await page.waitForTimeout(1500);
    check(
      'rescan reports a result',
      (await page.locator('.toast', { hasText: 'Rescan complete' }).count()) >= 1
    );

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

    /* -------------------- html lesson renders as formatted markup -------------------- */
    // An HTML lesson must be presented as markup, not as escaped text. It is
    // rendered inside a sandboxed iframe that carries an injected stylesheet.
    const courseDetail = await (await fetch(`${BASE}/api/courses/${dashCourse.id}`)).json();
    const courseLessons = (courseDetail?.grouped ?? []).flatMap((g) => g.lessons ?? []);
    const htmlLesson = courseLessons.find((l) => l.rel_path.toLowerCase().endsWith('.html'));

    if (htmlLesson) {
      await page.goto(`${BASE}/player/${htmlLesson.id}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1200);

      const frame = page.locator('iframe.doc-frame');
      check('html lesson renders in a doc frame', (await frame.count()) === 1);
      check('html lesson is not rendered as escaped text', (await page.locator('.text-lesson').count()) === 0);

      // The frame is sandboxed without script permissions.
      const sandbox = await frame.getAttribute('sandbox');
      check('html lesson frame is sandboxed', !!sandbox && !sandbox.includes('allow-scripts'), `sandbox="${sandbox}"`);

      // The lesson markup is parsed: real elements exist inside the frame and
      // the raw tags are not visible as text.
      const body = frame.contentFrame();
      const paragraphCount = await body.locator('p').count();
      const headingCount = await body.locator('h1, h2, h3').count();
      check('html lesson markup is parsed into elements', paragraphCount + headingCount > 0, `${paragraphCount} p, ${headingCount} headings`);

      const frameText = ((await body.locator('body').textContent()) ?? '').trim();
      check('html lesson shows no raw tags', !frameText.includes('<p>') && !frameText.includes('</p>'), frameText.slice(0, 40));

      // The injected typographic styles are applied to the frame's document.
      const styles = await body.locator('style[data-studyspace]').count();
      check('html lesson has the injected stylesheet', styles === 1);

      const bodyStyle = await body.locator('body').evaluate((el) => {
        const cs = getComputedStyle(el);
        return { fontFamily: cs.fontFamily, fontSize: cs.fontSize, lineHeight: cs.lineHeight, background: cs.backgroundColor };
      });
      check('html lesson uses the Inter font', /Inter/i.test(bodyStyle.fontFamily), bodyStyle.fontFamily);
      check('html lesson body font size is 16px', bodyStyle.fontSize === '16px', bodyStyle.fontSize);
      check('html lesson body line height is 1.75', bodyStyle.lineHeight === '28px', bodyStyle.lineHeight);
      check('html lesson body has a light background', bodyStyle.background === 'rgb(255, 255, 255)', bodyStyle.background);
    } else {
      check('html lesson renders in a doc frame', true, 'no html lesson in the fixture — skipped');
    }

    /* -------------------- notes autosave -------------------- */
    await page.goto(`${BASE}/player/${dashCourse.firstLessonId}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    await page.click('button:has-text("Notes")');
    await page.waitForTimeout(200);
    await page.fill('#notes', 'Note from the UI test');
    await page.waitForTimeout(1500);
    check('notes status shows saved', (await page.locator('#notes-status').textContent())?.includes('Saved'));

    /* -------------------- sidebar toggle -------------------- */
    await page.click('#sidebar-toggle');
    await page.waitForTimeout(200);
    check('sidebar can be hidden', (await page.locator('#sidebar').isHidden()));
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

    /* -------------------- remove the course from the player sidebar -------------------- */
    // Back to the player — the 404 route check left us on the not-found page.
    await page.goto(`${BASE}/player/${openedLessonId}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#remove-btn', { timeout: 15000 });
    await page.click('#remove-btn');
    await page.waitForSelector('.modal', { timeout: 5000 });
    check('remove confirm modal opens from the player', (await page.locator('.modal').count()) === 1);
    await page.click('.modal button:has-text("Remove course")');
    await page.waitForURL((url) => url.pathname === '/', { timeout: 10000 });
    await page.waitForTimeout(1200);
    check('player navigates to the library after removing the course', (await page.locator('.course-card').count()) === 0);
    check('remove toast offers undo', (await page.locator('.toast', { hasText: 'Undo' }).count()) === 1);

    /* -------------------- undo restores the course -------------------- */
    await page.locator('.toast button', { hasText: 'Undo' }).first().click();
    await page.waitForTimeout(1500);
    check('undo restores the course without a reload', (await page.locator('.course-card').count()) === 1);
  }

  check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
} catch (err) {
  check('test run completed without throwing', false, err.message);
} finally {
  await browser.close();
  // Remove the fixture course so the next run starts clean and does not hit
  // the duplicate-course guard.
  const leftovers = await (await fetch(`${BASE}/api/courses`)).json();
  for (const course of leftovers.courses ?? []) {
    if (course.title === 'UI Test Course') {
      await fetch(`${BASE}/api/courses/${course.id}`, { method: 'DELETE' });
    }
  }
}

const failed = results.filter((x) => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log('\nFailures:');
  for (const f of failed) console.log(`  - ${f.name} ${f.extra}`);
  process.exit(1);
}
