/**
 * Where a course card should open.
 *
 * A course opens on its resume lesson when there is an unfinished one, and on
 * its first lesson otherwise. This is the single place that rule lives — the
 * dashboard card, the legacy `/courses/:id` redirect and the "already in your
 * library" flow all resolve their target through here.
 */

/** A lesson id we can navigate to, or null. */
function validId(id) {
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * The lesson a course should open on: the resume lesson if there is one,
 * otherwise the first lesson. Null when the course has no lessons at all.
 */
export function resolveLessonId(course) {
  if (!course) return null;
  return validId(course.resumeLessonId) ?? validId(course.firstLessonId) ?? null;
}

/**
 * The player URL for a course, or null when it has nothing to play.
 *
 * The `?resume=1` marker matches the existing Resume buttons, so a course
 * opened from the card behaves the same as one opened from Resume.
 */
export function courseTargetUrl(course) {
  const id = resolveLessonId(course);
  if (!id) return null;
  return validId(course?.resumeLessonId) === id ? `/player/${id}?resume=1` : `/player/${id}`;
}
